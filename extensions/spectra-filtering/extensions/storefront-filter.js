/**
 * Spectra Storefront Filtering - App Embed
 * Injects JavaScript to filter product gallery images based on variant selection
 */

(function() {
  'use strict';

  const CONFIG = {
    debug: false,
    filterSpeed: 300, // ms for fade animation
  };

  // Log function
  function log(...args: any[]) {
    if (CONFIG.debug) {
      console.log('[Spectra]', ...args);
    }
  }

  // Get variant media mapping from metafields
  function getVariantMediaMap(): Record<string, string[]> {
    const script = document.getElementById('SpectraVariantMediaMap');
    if (!script) return {};

    try {
      return JSON.parse(script.textContent || '{}');
    } catch (e) {
      log('Error parsing variant media map:', e);
      return {};
    }
  }

  // Get global media IDs
  function getGlobalMedia(): string[] {
    const script = document.getElementById('SpectraGlobalMedia');
    if (!script) return [];

    try {
      return JSON.parse(script.textContent || '[]');
    } catch (e) {
      return [];
    }
  }

  // Extract media ID from various GID formats
  function extractMediaId(gid: string): string {
    const match = gid.match(/(\d+)$/);
    return match ? match[1] : gid;
  }

  // Filter gallery images based on variant
  function filterGallery(variantId: string) {
    const mediaMap = getVariantMediaMap();
    const globalMedia = getGlobalMedia();

    log('Filtering for variant:', variantId);
    log('Media map:', mediaMap);
    log('Global media:', globalMedia);

    // Get media IDs for this variant
    const variantMediaIds = mediaMap[variantId] || [];
    const globalMediaIds = globalMedia.map(extractMediaId);
    const allAllowedIds = [...variantMediaIds.map(extractMediaId), ...globalMediaIds];

    // Find gallery images
    const galleryImages = document.querySelectorAll([
      '.product__media-item',
      '.media-gallery__image',
      '[data-media-id]',
      '.product-gallery img',
      '.product-single__photo',
    ].join(', '));

    log('Found gallery images:', galleryImages.length);

    galleryImages.forEach(img => {
      const container = img.closest('[data-media-id]') || img.closest('.media-gallery__item') || img;
      const mediaIdAttr = container.getAttribute('data-media-id') ||
                         img.getAttribute('data-media-id');

      if (!mediaIdAttr) {
        // If no media ID found, try to extract from src
        const srcId = img.src?.match(/\/(\d+)\./)?.[1];
        if (srcId) {
          const shouldShow = allAllowedIds.length === 0 || allAllowedIds.includes(srcId);
          setVisibility(container, shouldShow);
        }
        return;
      }

      const mediaId = extractMediaId(mediaIdAttr);
      const shouldShow = allAllowedIds.length === 0 || allAllowedIds.includes(mediaId);

      setVisibility(container, shouldShow);
    });

    // Update featured/main image if needed
    updateMainImage(variantMediaIds[0], globalMediaIds[0]);
  }

  // Set visibility with animation
  function setVisibility(element: Element, visible: boolean) {
    if (visible) {
      element.style.display = '';
      element.style.opacity = '1';
    } else {
      element.style.display = 'none';
      element.style.opacity = '0';
    }
  }

  // Update main featured image
  function updateMainImage(variantImageId: string | undefined, globalImageId: string | undefined) {
    const featuredImage = document.querySelector('.product__featured-photo, .product-single__featured, .featured-image img');

    if (featuredImage && variantImageId) {
      const newSrc = featuredImage.getAttribute('src')?.replace(/\/\d+\./, `/${variantImageId}.`);
      if (newSrc && newSrc !== featuredImage.getAttribute('src')) {
        (featuredImage as HTMLImageElement).src = newSrc;
      }
    }
  }

  // Listen for variant changes
  function setupVariantListeners() {
    // Method 1: Listen for custom events from Shopify
    document.addEventListener('variant:change', (e: any) => {
      log('Variant change event:', e.detail);
      const variantId = e.detail?.variant?.id || e.detail?.variantId;
      if (variantId) {
        filterGallery(String(variantId));
      }
    });

    // Method 2: Monitor variant input changes
    const variantInputs = document.querySelectorAll('input[name*="option"], select[name*="option"], variant-inputs input, variant-selects select');

    variantInputs.forEach(input => {
      input.addEventListener('change', () => {
        // Find the currently selected variant
        const selectedVariant = findSelectedVariant();
        if (selectedVariant) {
          filterGallery(selectedVariant);
        }
      });
    });

    // Method 3: Mutation observer for dynamic changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as Element;
          if (target.classList.contains('variant-input') || target.classList.contains('swatch')) {
            const selectedVariant = findSelectedVariant();
            if (selectedVariant) {
              filterGallery(selectedVariant);
            }
          }
        }
      });
    });

    // Observe variant wrapper
    const variantWrapper = document.querySelector('.variant-wrapper, .product-variant-picker, [data-variant-inputs]');
    if (variantWrapper) {
      observer.observe(variantWrapper, {
        attributes: true,
        subtree: true,
      });
    }
  }

  // Find currently selected variant ID
  function findSelectedVariant(): string | null {
    // Try to find from window.Shopify object (if available)
    if ((window as any).Shopify?.Analytics?.product?.variantId) {
      return String((window as any).Shopify.Analytics.product.variantId);
    }

    // Try to extract from selected inputs
    const checkedInputs = document.querySelectorAll('input[name*="option"]:checked, select[name*="option"]');
    if (checkedInputs.length > 0) {
      // Build variant ID from selected options
      const options = Array.from(checkedInputs).map(i => (i as HTMLInputElement).value);
      // This would need to match against product variants - simplified for now
      return null;
    }

    return null;
  }

  // Initialize
  function init() {
    log('Spectra storefront filtering initializing...');

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(init, 100);
      });
      return;
    }

    // Setup listeners
    setupVariantListeners();

    // Filter on initial load if a variant is selected
    const initialVariant = findSelectedVariant();
    if (initialVariant) {
      setTimeout(() => filterGallery(initialVariant), 500);
    }

    log('Spectra storefront filtering initialized');
  }

  // Auto-initialize
  init();

  // Also re-init on Shopify section reload
  document.addEventListener('shopify:section:load', init);

})();
