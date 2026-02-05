import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Camera, Play, Heart, AlertCircle, Check } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

interface SmileRecordingProps {
  videoUrl: string;
  thumbnailUrl?: string; // Keyframe de fin (sera floutée pendant l'enregistrement)
  onComplete: (reactionVideo: Blob) => void;
  onSkip: () => void;
  premiumMonths?: number;
  premiumLevelName?: string;
}

export function SmileRecording({
  videoUrl,
  thumbnailUrl,
  onComplete,
  onSkip,
  premiumMonths = 3,
  premiumLevelName = 'Premium',
}: SmileRecordingProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('video/webm');

  const [step, setStep] = useState<'intro' | 'ready' | 'playing' | 'done'>('intro');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  // Initialize webcam
  useEffect(() => {
    async function initWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
        }
        setHasPermission(true);

        // Setup MediaRecorder with fallback mimeTypes
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4',
        ];
        const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
        mimeTypeRef.current = supportedMimeType;
        console.log('[SmileRecording] Using mimeType:', supportedMimeType);

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: supportedMimeType,
        });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
          console.log('[SmileRecording] Recording complete, blob size:', blob.size);
          setRecordedBlob(blob);
          chunksRef.current = [];
        };
        mediaRecorderRef.current = mediaRecorder;
      } catch (err) {
        console.error('Webcam error:', err);
        setHasPermission(false);
      }
    }

    if (step !== 'intro') {
      initWebcam();
    }

    return () => {
      if (webcamRef.current?.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [step]);

  // Start recording and switch to playing step
  const startExperience = useCallback(() => {
    if (!mediaRecorderRef.current) {
      console.error('[SmileRecording] MediaRecorder not ready');
      return;
    }

    console.log('[SmileRecording] Starting experience...');
    // Start recording
    mediaRecorderRef.current.start();
    setIsRecording(true);
    setStep('playing');
  }, []);

  // Handle video end
  const handleVideoEnd = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop webcam when recording is done
      if (webcamRef.current?.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        webcamRef.current.srcObject = null;
        console.log('[SmileRecording] Webcam stopped');
      }

      setStep('done');
    }
  }, [isRecording]);

  // Submit reaction
  const handleSubmit = useCallback(() => {
    console.log('[SmileRecording] handleSubmit called, blob:', recordedBlob?.size);
    if (recordedBlob) {
      console.log('[SmileRecording] Calling onComplete with blob size:', recordedBlob.size);
      onComplete(recordedBlob);
    } else {
      console.error('[SmileRecording] No recorded blob available!');
    }
  }, [recordedBlob, onComplete]);

  // No permission view
  if (hasPermission === false) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-12 h-12 text-teal-400 mx-auto mb-4" />
        <h3 className="font-display text-xl text-gray-800 mb-2">
          {t('smile.noPermissionTitle')}
        </h3>
        <p className="text-gray-600 mb-6">
          {t('smile.noPermissionDesc')}
        </p>
        <button onClick={onSkip} className="btn-secondary">
          {t('smile.preferPay')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {/* Intro step */}
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-teal flex items-center justify-center mx-auto">
              <Heart className="w-10 h-10 text-white fill-white heart-beat" />
            </div>

            <div>
              <h2 className="font-display text-2xl sm:text-3xl text-gray-900 mb-3">
                {t('smile.introTitle')}
              </h2>
              <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                {t('smile.introText')}
              </p>
            </div>

            <div className="card bg-gradient-to-br from-teal-50 to-blush-50 border-teal-100 max-w-md mx-auto">
              <p className="text-teal-700 italic text-sm leading-relaxed">
                "{t('smile.quote')}"
              </p>
            </div>

            <button
              onClick={() => setStep('ready')}
              className="btn-primary inline-flex items-center gap-2 py-4 px-8"
            >
              <Camera className="w-5 h-5" />
              {t('smile.prepareButton')}
            </button>

            <button
              onClick={onSkip}
              className="block mx-auto text-sm text-gray-500 hover:text-gray-700"
            >
              {t('smile.preferPayLink')}
            </button>
          </motion.div>
        )}

        {/* Ready step */}
        {step === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="font-display text-2xl text-gray-900 mb-2">
                {t('smile.readyTitle')}
              </h2>
              <p className="text-gray-600">
                {t('smile.readyText')}
              </p>
            </div>

            {/* Webcam preview */}
            <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video">
              <video
                ref={webcamRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/50 text-white text-sm flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {t('smile.preview')}
              </div>
            </div>

            <button
              onClick={startExperience}
              disabled={!hasPermission}
              className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              {t('smile.startButton')}
            </button>
          </motion.div>
        )}

        {/* Playing step - shows blurred thumbnail while recording reaction */}
        {step === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Blurred thumbnail preview (video plays for timing but visually hidden) */}
            <div className="relative rounded-2xl overflow-hidden bg-gray-900">
              {/* Video plays but is visually hidden behind the blurred thumbnail */}
              <video
                ref={videoRef}
                src={videoUrl}
                autoPlay
                playsInline
                muted
                onEnded={handleVideoEnd}
                onCanPlay={() => {
                  console.log('[SmileRecording] Video can play, starting...');
                  videoRef.current?.play().catch(err => {
                    console.error('[SmileRecording] Video play error:', err);
                  });
                }}
                className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
              />

              {/* Blurred thumbnail as visible teaser (covers the video) */}
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="w-full aspect-video object-cover blur-xl scale-110"
                />
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-teal-900 to-gray-900" />
              )}

              {/* Overlay with text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                <Heart className="w-16 h-16 text-white/80 mb-4 heart-beat" />
                <p className="text-white text-lg font-medium">{t('smile.recordingYourReaction')}</p>
              </div>

              {/* Recording indicator */}
              <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-red-500 text-white text-sm flex items-center gap-2 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-white" />
                {t('smile.recording')}
              </div>

              {/* Webcam PiP */}
              <div className="absolute bottom-4 right-4 w-32 h-24 rounded-xl overflow-hidden border-2 border-white shadow-lg">
                <video
                  ref={webcamRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              </div>
            </div>

            <p className="text-center text-gray-500 text-sm">
              {t('smile.smileAtCamera')}
            </p>
          </motion.div>
        )}

        {/* Done step */}
        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-teal-600" />
            </div>

            <div>
              <h2 className="font-display text-2xl text-gray-900 mb-2">
                {t('smile.doneTitle')}
              </h2>
              <p className="text-gray-600">
                {t('smile.doneText')}
              </p>
            </div>

            <button
              onClick={handleSubmit}
              className="btn-primary flex flex-col items-center gap-1 py-4 px-8"
            >
              <span className="flex items-center gap-2">
                <Heart className="w-5 h-5" />
                {t('smile.submitButton')}
              </span>
              <span className="text-xs opacity-80">
                {t('smile.submitActivate', { months: premiumMonths, level: premiumLevelName })}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
