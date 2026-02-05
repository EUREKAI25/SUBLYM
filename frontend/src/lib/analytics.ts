// Google Analytics 4 integration
// Set VITE_GA_MEASUREMENT_ID in .env to enable (e.g., G-XXXXXXXXXX)

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let initialized = false;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function initGA() {
  if (initialized || !GA_ID) return;
  initialized = true;

  // Load gtag.js script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer and gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    send_page_view: false, // We track page views manually via React Router
  });
}

export function trackPageView(path: string, title?: string) {
  if (!GA_ID || !initialized) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
  });
}

export function trackEvent(action: string, category: string, label?: string, value?: number) {
  if (!GA_ID || !initialized) return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}
