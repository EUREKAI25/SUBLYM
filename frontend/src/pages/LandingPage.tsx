import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Camera, Wand2, Film, User } from 'lucide-react';
import { Header } from '@/components';
import { useAuth, useI18n } from '@/hooks';

export function LandingPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Parse le titre pour gérer le <em>
  const renderTitle = () => {
    const title = t('landing.title');
    const parts = title.split(/<em>|<\/em>/);
    return (
      <>
        {parts[0]}
        <span className="text-teal-600 italic">{parts[1]}</span>
        {parts[2]}
      </>
    );
  };

  // Layout pour utilisateur NON connecté
  if (!user) {
    return (
      <div className="min-h-screen">
        {/* Video Background - full screen */}
        <div className="video-background">
          {!videoLoaded && (
            <img
              src="/background.gif"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <video
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setVideoLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
          >
            <source src="/background.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Login icon top right */}
        <Link
          to="/login"
          className="fixed top-6 right-6 z-50 p-2 text-white/80 hover:text-white transition-colors"
          aria-label={t('common.login')}
        >
          <User className="w-6 h-6" />
        </Link>

        {/* Hero Section with large white logo */}
        <section className="relative min-h-[45vh] flex flex-col items-center justify-center px-4 pt-8">
          <motion.img
            src="/logo-white.svg"
            alt="SUBLYM"
            className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          />
        </section>

        {/* White overlay content */}
        <div className="relative bg-white/90 rounded-t-[25px] min-h-[55vh] px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {/* Titre */}
              <h1 className="font-serif text-2xl sm:text-[2.25rem] md:text-[2.75rem] text-dark mb-4 leading-tight">
                {renderTitle()}
              </h1>

              {/* Sous-titre */}
              <p className="font-body text-base sm:text-lg text-gray-600 max-w-xl mx-auto mb-8 leading-relaxed">
                {t('landing.subtitle')}
              </p>

              {/* CTA */}
              <Link
                to="/create"
                className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-4 inline-flex items-center gap-3"
              >
                {t('landing.cta')}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>

          {/* Features Section */}
          <div className="max-w-5xl mx-auto mt-16 sm:mt-20">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                { icon: Camera, titleKey: 'step1Title', descKey: 'step1Desc' },
                { icon: Wand2, titleKey: 'step2Title', descKey: 'step2Desc' },
                { icon: Film, titleKey: 'step3Title', descKey: 'step3Desc' },
              ].map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15 }}
                    className="bg-white rounded-2xl p-6 text-center shadow-md border border-gray-100"
                  >
                    <div className="flex justify-center mb-4">
                      <IconComponent className="w-10 h-10 text-dark" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-display text-lg text-dark mb-2">
                      {t(`landing.${step.titleKey}`)}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {t(`landing.${step.descKey}`)}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer - after white content area */}
        <footer className="relative py-8 px-4 sm:px-6" style={{ background: 'rgba(3, 40, 36, 0.9)' }}>
          <div className="max-w-5xl mx-auto text-center space-y-3">
            <div className="flex justify-center gap-6 text-sm">
              <Link to="/contact" className="text-white/60 hover:text-white transition-colors">
                {t('contact.title')}
              </Link>
              <Link to="/terms" className="text-white/60 hover:text-white transition-colors">
                {t('terms.title')}
              </Link>
            </div>
            <p className="text-white/30" style={{ fontSize: '0.75rem' }}>
              {t('landing.copyright', { year: new Date().getFullYear().toString() })}
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // Layout pour utilisateur CONNECTÉ
  return (
    <div className="min-h-screen">
      {/* Video Background */}
      <div className="video-background">
        {!videoLoaded && (
          <img
            src="/background.gif"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <video
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setVideoLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
        >
          <source src="/background.mp4" type="video/mp4" />
        </video>
      </div>

      {/* White header with black logo */}
      <Header />

      {/* Spacer - shows video through gap */}
      <div className="h-[85px] sm:h-[100px]" />

      {/* White content area */}
      <div className="relative bg-white/90 min-h-screen">
        {/* Content */}
        <section className="pt-12 sm:pt-16 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Titre */}
              <h1 className="font-serif text-2xl sm:text-[2.25rem] md:text-[2.75rem] text-dark mb-4 leading-tight">
                {renderTitle()}
              </h1>

              {/* Sous-titre */}
              <p className="font-body text-base sm:text-lg text-dark/70 max-w-xl mx-auto mb-8 leading-relaxed">
                {t('landing.subtitle')}
              </p>

              {/* CTA */}
              <Link
                to="/create"
                className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-4 inline-flex items-center gap-3"
              >
                {t('landing.cta')}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                { icon: Camera, titleKey: 'step1Title', descKey: 'step1Desc' },
                { icon: Wand2, titleKey: 'step2Title', descKey: 'step2Desc' },
                { icon: Film, titleKey: 'step3Title', descKey: 'step3Desc' },
              ].map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15 }}
                    className="bg-white rounded-2xl p-6 text-center shadow-md border border-gray-100"
                  >
                    <div className="flex justify-center mb-4">
                      <IconComponent className="w-10 h-10 text-dark" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-display text-lg text-dark mb-2">
                      {t(`landing.${step.titleKey}`)}
                    </h3>
                    <p className="text-dark/70 text-sm">
                      {t(`landing.${step.descKey}`)}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      {/* Footer - after white content area */}
      <footer className="relative py-8 px-4 sm:px-6" style={{ background: 'rgba(3, 40, 36, 0.9)' }}>
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <div className="flex justify-center gap-6 text-sm">
            <Link to="/contact" className="text-white/60 hover:text-white transition-colors">
              {t('contact.title')}
            </Link>
            <Link to="/terms" className="text-white/60 hover:text-white transition-colors">
              {t('terms.title')}
            </Link>
          </div>
          <p className="text-white/30" style={{ fontSize: '0.75rem' }}>
            {t('landing.copyright', { year: new Date().getFullYear().toString() })}
          </p>
        </div>
      </footer>
    </div>
  );
}
