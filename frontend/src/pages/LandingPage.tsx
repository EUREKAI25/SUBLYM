import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Header } from '@/components';
import { useAuth, useI18n } from '@/hooks';

export function LandingPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  // Parse le titre pour gérer le <em>
  const renderTitle = () => {
    const title = t('landing.title');
    const parts = title.split(/<em>|<\/em>/);
    return (
      <>
        {parts[0]}
        <span className="text-wine-600 italic">{parts[1]}</span>
        {parts[2]}
      </>
    );
  };

  return (
    <div className="min-h-screen">
      <Header transparent />

      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden px-4">
        {/* Background decorations subtiles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute hidden sm:block"
              style={{
                left: `${15 + i * 30}%`,
                top: `${30 + (i % 2) * 25}%`,
              }}
              animate={{
                y: [0, -10, 0],
                opacity: [0.1, 0.2, 0.1],
              }}
              transition={{
                duration: 5 + i,
                repeat: Infinity,
                delay: i * 0.8,
              }}
            >
              <Sparkles
                className="text-wine-300"
                style={{ width: 20 + i * 8, height: 20 + i * 8 }}
              />
            </motion.div>
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto text-center pt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wine-100 text-wine-700 text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              {t('landing.badge')}
            </div>

            {/* Titre */}
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-charcoal-900 mb-6 leading-tight px-2">
              {renderTitle()}
            </h1>

            {/* Sous-titre */}
            <p className="text-lg sm:text-xl text-charcoal-600 max-w-xl mx-auto mb-10 leading-relaxed px-4">
              {t('landing.subtitle')}
            </p>

            {/* CTA */}
            <Link
              to="/create"
              className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-4 inline-flex items-center gap-3"
            >
              <Sparkles className="w-5 h-5" />
              {t('landing.cta')}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="font-display text-3xl sm:text-4xl text-charcoal-900 mb-4">
              {t('landing.howItWorks')}
            </h2>
            <p className="text-charcoal-600 text-base sm:text-lg">
              {t('landing.howItWorksSubtitle')}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { icon: '📸', titleKey: 'step1Title', descKey: 'step1Desc' },
              { icon: '✨', titleKey: 'step2Title', descKey: 'step2Desc' },
              { icon: '🎬', titleKey: 'step3Title', descKey: 'step3Desc' },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="card text-center"
              >
                <div className="text-4xl sm:text-5xl mb-4">{step.icon}</div>
                <h3 className="font-display text-lg sm:text-xl text-charcoal-800 mb-3">
                  {t(`landing.${step.titleKey}`)}
                </h3>
                <p className="text-charcoal-600 text-sm sm:text-base">
                  {t(`landing.${step.descKey}`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="font-display text-3xl sm:text-4xl text-charcoal-900 mb-4">
              {t('landing.testimonialsTitle')}
            </h2>
            <p className="text-charcoal-600 text-base sm:text-lg">
              {t('landing.testimonialsSubtitle')}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3].map((num, index) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="bg-gradient-to-br from-blush-50 to-cream-50 rounded-3xl p-6 sm:p-8 relative"
              >
                {/* Quote icon */}
                <div className="absolute top-4 right-4 text-wine-200 text-4xl font-serif">"</div>
                
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-gold-500 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>

                {/* Text */}
                <p className="text-charcoal-700 mb-6 italic leading-relaxed">
                  "{t(`landing.testimonial${num}Text`)}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-romantic flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-charcoal-800">
                      {t(`landing.testimonial${num}Name`)}
                    </p>
                    <p className="text-sm text-charcoal-500">
                      {t(`landing.testimonial${num}Location`)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="card bg-gradient-to-br from-wine-50 to-blush-50 border-wine-100">
            <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-wine-500 mx-auto mb-6" />
            <h2 className="font-display text-2xl sm:text-3xl text-wine-900 mb-4">
              {t('landing.ctaTitle')}
            </h2>
            <p className="text-wine-700 mb-8 max-w-lg mx-auto text-sm sm:text-base">
              {t('landing.ctaSubtitle')}
            </p>
            <Link
              to="/create"
              className="btn-primary inline-flex items-center gap-2"
            >
              {t('landing.ctaButton')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-4 sm:px-6 border-t border-wine-100">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <div className="flex justify-center gap-6 text-sm">
            <Link to="/contact" className="text-charcoal-500 hover:text-wine-600 transition-colors">
              {t('contact.title')}
            </Link>
            <Link to="/terms" className="text-charcoal-500 hover:text-wine-600 transition-colors">
              {t('terms.title')}
            </Link>
          </div>
          <p className="text-sm text-charcoal-500">
            {t('landing.copyright', { year: new Date().getFullYear().toString() })}
          </p>
        </div>
      </footer>
    </div>
  );
}
