import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component
 * Automatically scrolls to top of page when route changes
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top immediately when route changes
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Use 'instant' for immediate scroll, 'smooth' for animated
    });

    // Also scroll the main content area if it exists
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }

    // Scroll any scrollable containers
    const scrollableContainers = document.querySelectorAll('[data-scrollable]');
    scrollableContainers.forEach(container => {
      container.scrollTop = 0;
    });

  }, [pathname]); // Trigger on pathname change

  return null; // This component doesn't render anything
};

export default ScrollToTop;
