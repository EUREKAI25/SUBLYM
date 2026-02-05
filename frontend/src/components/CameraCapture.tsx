import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, RotateCcw, Check, Upload, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

interface PoseGuide {
  key: string;
  icon: string;
  labelKey: string;
  descKey: string;
}

const POSES: PoseGuide[] = [
  { key: 'face_smile', icon: '😊', labelKey: 'poseFaceSmile', descKey: 'poseFaceSmileDesc' },
  { key: 'face_neutral', icon: '😐', labelKey: 'poseFaceNeutral', descKey: 'poseFaceNeutralDesc' },
  { key: 'profile_smile', icon: '🙂', labelKey: 'poseProfileSmile', descKey: 'poseProfileSmileDesc' },
  { key: 'profile_neutral', icon: '😶', labelKey: 'poseProfileNeutral', descKey: 'poseProfileNeutralDesc' },
];

interface CameraCaptureProps {
  onPhotosComplete: (photos: File[]) => void;
  onSwitchToUpload: () => void;
}

export function CameraCapture({
  onPhotosComplete,
  onSwitchToUpload,
}: CameraCaptureProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<(File | null)[]>([null, null, null, null]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const currentPose = POSES[currentPoseIndex];
  const completedCount = capturedPhotos.filter(Boolean).length;

  const initCamera = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata — handle race condition where event already fired
        if (videoRef.current.readyState < 1) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 3000); // fallback timeout
            videoRef.current!.addEventListener('loadedmetadata', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
          });
        }
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video autoplay failed, user interaction may be required:', playErr);
        }
      }
      setHasPermission(true);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Camera error:', err);
      setIsLoading(false);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(t('camera.permissionDenied'));
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage(t('camera.notFound'));
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMessage(t('camera.inUse'));
      } else {
        setErrorMessage(t('camera.accessError'));
      }
      setHasPermission(false);
    }
  }, [facingMode]);

  useEffect(() => {
    initCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initCamera]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);
    
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(null);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `pose_${currentPose.key}_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const newPhotos = [...capturedPhotos];
        newPhotos[currentPoseIndex] = file;
        setCapturedPhotos(newPhotos);
        
        if (currentPoseIndex < POSES.length - 1) {
          setTimeout(() => setCurrentPoseIndex(currentPoseIndex + 1), 500);
        }
      }
      setIsCapturing(false);
    }, 'image/jpeg', 0.9);
  }, [currentPoseIndex, capturedPhotos, isCapturing, facingMode, currentPose.key]);

  const retakePhoto = useCallback(() => {
    const newPhotos = [...capturedPhotos];
    newPhotos[currentPoseIndex] = null;
    setCapturedPhotos(newPhotos);
  }, [currentPoseIndex, capturedPhotos]);

  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  const handleComplete = useCallback(() => {
    const validPhotos = capturedPhotos.filter((p): p is File => p !== null);
    if (validPhotos.length >= 1) {
      onPhotosComplete(validPhotos);
    }
  }, [capturedPhotos, onPhotosComplete]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full mx-auto mb-4" />
        <p className="text-gray-600">{t('camera.initializing')}</p>
      </div>
    );
  }

  if (hasPermission === false) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-teal-400 mx-auto mb-4" />
        <h3 className="font-display text-xl text-dark mb-2">{t('camera.noPermissionTitle')}</h3>
        <p className="text-gray-600 mb-6 max-w-sm mx-auto text-sm">{errorMessage}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={initCamera} className="btn-secondary inline-flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" />
            {t('common.retry')}
          </button>
          <button onClick={onSwitchToUpload} className="btn-primary inline-flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            {t('camera.importPhotos')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {POSES.map((pose, index) => (
          <button
            key={pose.key}
            onClick={() => setCurrentPoseIndex(index)}
            className={cn(
              'w-3 h-3 rounded-full transition-all',
              index === currentPoseIndex
                ? 'bg-teal-600 scale-125'
                : capturedPhotos[index]
                ? 'bg-teal-400'
                : 'bg-gray-200'
            )}
          />
        ))}
      </div>

      {/* Current pose instruction */}
      <motion.div
        key={currentPoseIndex}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="text-3xl mb-1">{currentPose.icon}</div>
        <h3 className="font-display text-lg text-dark">
          {t(`camera.${currentPose.labelKey}`)}
        </h3>
        <p className="text-gray-600 text-sm">
          {t(`camera.${currentPose.descKey}`)}
        </p>
      </motion.div>

      {/* Camera + Capture Button - Layout horizontal */}
      <div className="flex gap-4 items-center">
        {/* Camera view */}
        <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3] flex-1 max-h-[250px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'w-full h-full object-cover',
              facingMode === 'user' && 'scale-x-[-1]'
            )}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Face guide */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className={cn(
              'w-28 h-36 border-3 border-dashed rounded-full opacity-50',
              currentPose.key.includes('profile') ? 'border-teal-400' : 'border-white'
            )} />
          </div>

          {/* Countdown */}
          <AnimatePresence>
            {countdown !== null && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="text-5xl font-bold text-white drop-shadow-lg">{countdown}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Switch camera */}
          <button
            onClick={switchCamera}
            className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Captured indicator */}
          {capturedPhotos[currentPoseIndex] && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-green-500 text-white text-xs font-medium flex items-center gap-1">
              <Check className="w-3 h-3" />
              OK
            </div>
          )}
        </div>

        {/* Capture button - à côté de la caméra */}
        <div className="flex flex-col gap-2 w-28 shrink-0">
          {capturedPhotos[currentPoseIndex] ? (
            <>
              <button
                onClick={retakePhoto}
                className="btn-secondary flex items-center justify-center gap-1 py-3 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Reprendre
              </button>
              {currentPoseIndex < POSES.length - 1 ? (
                <button
                  onClick={() => setCurrentPoseIndex(currentPoseIndex + 1)}
                  className="btn-primary flex items-center justify-center gap-1 py-3 text-sm"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={completedCount < 1}
                  className="btn-primary flex items-center justify-center gap-1 py-3 text-sm"
                >
                  <Check className="w-4 h-4" />
                  Terminer
                </button>
              )}
            </>
          ) : (
            <button
              onClick={capturePhoto}
              disabled={isCapturing}
              className="btn-primary flex flex-col items-center justify-center gap-1 py-6"
            >
              <Camera className="w-8 h-8" />
              <span className="text-sm">{isCapturing ? t('camera.capturing') : t('camera.photo')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex justify-center gap-2">
        {capturedPhotos.map((photo, index) => (
          <button
            key={index}
            onClick={() => setCurrentPoseIndex(index)}
            className={cn(
              'w-12 h-12 rounded-lg overflow-hidden border-2 transition-all',
              index === currentPoseIndex
                ? 'border-teal-600 ring-2 ring-teal-200'
                : capturedPhotos[index]
                ? 'border-teal-300'
                : 'border-gray-200'
            )}
          >
            {photo ? (
              <img src={URL.createObjectURL(photo)} alt={`Pose ${index + 1}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <span className="text-gray-400 text-xs">{index + 1}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Switch to upload */}
      <div className="text-center pt-2">
        <button
          onClick={onSwitchToUpload}
          className="text-teal-600 hover:text-teal-800 text-sm font-medium inline-flex items-center gap-1"
        >
          <Upload className="w-4 h-4" />
          {t('camera.preferUpload')}
        </button>
      </div>
    </div>
  );
}
