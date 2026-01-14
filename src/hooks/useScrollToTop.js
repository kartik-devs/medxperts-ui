import { useEffect } from 'react';

/**
 * Custom hook to scroll to top when component mounts
 * Usage: useScrollToTop() in any component
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.smooth - Use smooth scrolling (default: false)
 * @param {Array} options.dependencies - Dependencies to trigger scroll (default: [])
 */
export const useScrollToTop = (options = {}) => {
  const { smooth = false, dependencies = [] } = options;

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: smooth ? 'smooth' : 'instant'
    });

    // Also scroll main content if it exists
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  }, dependencies);
};

/**
 * Function to manually scroll to top
 * Can be called from event handlers
 * 
 * @param {boolean} smooth - Use smooth scrolling (default: true)
 */
export const scrollToTop = (smooth = true) => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: smooth ? 'smooth' : 'instant'
  });

  // Also scroll main content if it exists
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.scrollTop = 0;
  }
};

/**
 * Function to scroll to a specific element
 * 
 * @param {string} elementId - ID of element to scroll to
 * @param {boolean} smooth - Use smooth scrolling (default: true)
 * @param {number} offset - Offset from top in pixels (default: 0)
 */
export const scrollToElement = (elementId, smooth = true, offset = 0) => {
  const element = document.getElementById(elementId);
  if (element) {
    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: smooth ? 'smooth' : 'instant'
    });
  }
};

export default useScrollToTop;
