import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Camera, Play, Heart, AlertCircle, Check } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

interface SmileRecordingProps {
  videoUrl: string;
  onComplete: (reactionVideo: Blob) => void;
  onSkip: () => void;
}

export function SmileRecording({
  videoUrl,
  onComplete,
  onSkip,
}: SmileRecordingProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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

        // Setup MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
        });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
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

  // Start recording and play video
  const startExperience = useCallback(() => {
    if (!videoRef.current || !mediaRecorderRef.current) return;

    // Start recording
    mediaRecorderRef.current.start();
    setIsRecording(true);
    setStep('playing');

    // Play the video
    videoRef.current.play();
  }, []);

  // Handle video end
  const handleVideoEnd = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStep('done');
    }
  }, [isRecording]);

  // Submit reaction
  const handleSubmit = useCallback(() => {
    if (recordedBlob) {
      onComplete(recordedBlob);
    }
  }, [recordedBlob, onComplete]);

  // No permission view
  if (hasPermission === false) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-12 h-12 text-wine-400 mx-auto mb-4" />
        <h3 className="font-display text-xl text-charcoal-800 mb-2">
          {t('smile.noPermissionTitle')}
        </h3>
        <p className="text-charcoal-600 mb-6">
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
            <div className="w-20 h-20 rounded-full bg-gradient-romantic flex items-center justify-center mx-auto">
              <Heart className="w-10 h-10 text-white fill-white heart-beat" />
            </div>

            <div>
              <h2 className="font-display text-2xl sm:text-3xl text-charcoal-900 mb-3">
                {t('smile.introTitle')}
              </h2>
              <p className="text-charcoal-600 max-w-md mx-auto leading-relaxed">
                {t('smile.introText')}
              </p>
            </div>

            <div className="card bg-gradient-to-br from-wine-50 to-blush-50 border-wine-100 max-w-md mx-auto">
              <p className="text-wine-700 italic text-sm leading-relaxed">
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
              className="block mx-auto text-sm text-charcoal-500 hover:text-charcoal-700"
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
              <h2 className="font-display text-2xl text-charcoal-900 mb-2">
                {t('smile.readyTitle')}
              </h2>
              <p className="text-charcoal-600">
                {t('smile.readyText')}
              </p>
            </div>

            {/* Webcam preview */}
            <div className="relative rounded-2xl overflow-hidden bg-charcoal-900 aspect-video">
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

        {/* Playing step */}
        {step === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Main video */}
            <div className="relative rounded-2xl overflow-hidden bg-charcoal-900">
              <video
                ref={videoRef}
                src={videoUrl}
                onEnded={handleVideoEnd}
                className="w-full aspect-video object-cover"
              />

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

            <p className="text-center text-charcoal-500 text-sm">
              {t('smile.watchingHint')}
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
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-600" />
            </div>

            <div>
              <h2 className="font-display text-2xl text-charcoal-900 mb-2">
                {t('smile.doneTitle')}
              </h2>
              <p className="text-charcoal-600">
                {t('smile.doneText')}
              </p>
            </div>

            <button
              onClick={handleSubmit}
              className="btn-primary inline-flex items-center gap-2 py-4 px-8"
            >
              <Heart className="w-5 h-5" />
              {t('smile.submitButton')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
