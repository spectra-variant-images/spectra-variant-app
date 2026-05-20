/**
 * Spectra Product Gallery
 * Filters product gallery images based on selected variant
 * Reads variant->media mappings from metafields (no API calls)
 */

(function() {
  'use strict';

  // Metafield namespace and key for variant media mappings
  const METAFIELD_NAMESPACE = 'spectra';
  const METAFIELD_KEY = 'variant_media';
  const GLOBAL_MEDIA_KEY = 'global_media';

  // State
  let currentVariantId = null;
  let productMedia = [];
  let variantMediaMap = new Map();
  let globalMediaIds = new Set();

  /**
   * Initialize the gallery filter
   */
  function init() {
    if (!window.Shopify || !window.ShopifyAnalytics || !window.ShopifyAnalytics.meta) {
      // Retry if Shopify context not ready
      setTimeout(init, 100);
      return;
    }

    const meta = window.ShopifyAnalytics.meta;
    const product = meta.product;

    if (!product) {
      console.debug('[Spectra] No product found, skipping gallery init');
      return;
    }

    currentVariantId = getSelectedVariantId();
    productMedia = getProductMedia(product);
    loadMetafieldMappings(product);
    setupVariantListeners();

    // Apply initial filtering
    filterGallery(currentVariantId);
  }

  /**
   * Get currently selected variant ID
   */
  function getSelectedVariantId() {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const variantParam = urlParams.get('variant');
    if (variantParam) {
      return 'gid://shopify/ProductVariant/' + variantParam;
    }

    // Check for selected variant in various theme locations
    const variantSelectors = [
      'form[data-productid] [name="id"]',
      '.product-form input[name="id"]',
      '.variant-wrapper select[name="id"]',
      '#product-select-' + window.ShopifyAnalytics.meta.product.id,
    ];

    for (const selector of variantSelectors) {
      const input = document.querySelector(selector);
      if (input && input.value) {
        return 'gid://shopify/ProductVariant/' + input.value;
      }
    }

    return null;
  }

  /**
   * Extract all media items from product data
   */
  function getProductMedia(product) {
    const media = [];

    if (product.media) {
      product.media.forEach(item => {
        media.push({
          id: 'gid://shopify/' + (item.media_type || 'MediaImage') + '/' + item.id,
          src: item.src,
          alt: item.alt,
          mediaType: item.media_type || 'image',
          position: item.position
        });
      });
    } else if (product.images) {
      // Fallback for older themes
      product.images.forEach((img, index) => {
        media.push({
          id: 'gid://shopify/MediaImage/' + img.id,
          src: img,
          alt: product.image_alt || '',
          mediaType: 'image',
          position: index
        });
      });
    }

    return media;
  }

  /**
   * Load variant media mappings from product metafields
   */
  function loadMetafieldMappings(product) {
    // Try to get mappings from product JSON in page
    const productJson = document.getElementById('ProductJson-' + product.id);
    if (productJson) {
      try {
        const productData = JSON.parse(productJson.textContent);
        if (productData.metafields) {
          parseMetafields(productData.metafields);
          return;
        }
      } catch (e) {
        // Fall through to alternative methods
      }
    }

    // Try global product object
    if (window.product && window.product.metafields) {
      parseMetafields(window.product.metafields);
      return;
    }

    // Read from liquid-injected data attribute
    const spectraData = document.querySelector('[data-spectra-data]');
    if (spectraData) {
      try {
        const data = JSON.parse(spectraData.textContent);
        parseMetafields(data);
      } catch (e) {
        console.warn('[Spectra] Failed to parse metafields data', e);
      }
    }
  }

  /**
   * Parse metafields and build mapping
   */
  function parseMetafields(metafields) {
    // Parse global media IDs
    const globalMedia = metafields[METAFIELD_NAMESPACE]?.[GLOBAL_MEDIA_KEY];
    if (globalMedia) {
      try {
        const globalArray = typeof globalMedia === 'string' ? JSON.parse(globalMedia) : globalMedia;
        globalArray.forEach(id => globalMediaIds.add(id));
      } catch (e) {
        console.warn('[Spectra] Failed to parse global media', e);
      }
    }

    // Parse variant-specific media
    const variantMedia = metafields[METAFIELD_NAMESPACE]?.[METAFIELD_KEY];
    if (variantMedia) {
      try {
        const data = typeof variantMedia === 'string' ? JSON.parse(variantMedia) : variantMedia;

        // Format: { variantGid: [mediaGids] }
        Object.entries(data).forEach(([variantId, mediaIds]) => {
          variantMediaMap.set(variantId, Array.isArray(mediaIds) ? mediaIds : []);
        });
      } catch (e) {
        console.warn('[Spectra] Failed to parse variant media', e);
      }
    }
  }

  /**
   * Set up listeners for variant changes
   */
  function setupVariantListeners() {
    // Listen for URL changes (Shopify theme router)
    const observer = new MutationObserver(() => {
      const newVariantId = getSelectedVariantId();
      if (newVariantId && newVariantId !== currentVariantId) {
        currentVariantId = newVariantId;
        filterGallery(currentVariantId);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Listen for custom variant change events
    document.addEventListener('variant:change', (e) => {
      if (e.detail.variantId) {
        currentVariantId = 'gid://shopify/ProductVariant/' + e.detail.variantId;
        filterGallery(currentVariantId);
      }
    });

    // Listen for form submit events (variant selection)
    const forms = document.querySelectorAll('form[action*="/cart/add"], form[data-productid]');
    forms.forEach(form => {
      form.addEventListener('change', (e) => {
        if (e.target.name === 'id') {
          setTimeout(() => {
            const newId = getSelectedVariantId();
            if (newId !== currentVariantId) {
              currentVariantId = newId;
              filterGallery(currentVariantId);
            }
          }, 50);
        }
      });
    });
  }

  /**
   * Filter gallery to show only variant-specific media
   */
  function filterGallery(variantId) {
    if (!variantId) {
      // No variant selected, show all media
      showAllMedia();
      return;
    }

    const variantMediaIds = variantMediaMap.get(variantId);

    if (!variantMediaIds || variantMediaIds.length === 0) {
      // No mapping for this variant, show all
      showAllMedia();
      return;
    }

    // Combine variant media with global media
    const mediaToShow = new Set(variantMediaIds);
    globalMediaIds.forEach(id => mediaToShow.add(id));

    // Apply filtering
    applyGalleryFilter(mediaToShow);
  }

  /**
   * Show all media in gallery
   */
  function showAllMedia() {
    const galleryItems = getGalleryItems();
    galleryItems.forEach(item => {
      showGalleryItem(item);
    });
  }

  /**
   * Apply filter to gallery
   */
  function applyGalleryFilter(mediaIds) {
    const galleryItems = getGalleryItems();

    galleryItems.forEach(item => {
      const mediaId = getMediaIdFromItem(item);

      if (mediaIds.has(mediaId) || isGlobalMedia(item)) {
        showGalleryItem(item);
      } else {
        hideGalleryItem(item);
      }
    });

    // Dispatch custom event for other scripts
    document.dispatchEvent(new CustomEvent('spectra:gallery-filtered', {
      detail: { mediaIds: Array.from(mediaIds) }
    }));
  }

  /**
   * Get all gallery items from the page
   */
  function getGalleryItems() {
    // Try multiple selectors for theme compatibility
    const selectors = [
      '.media-gallery__media', // Dawn
      '.product__media-item', // Dawn older
      '.gallery-item', // Custom
      '.product-single__photo', // Venture
      '[data-media-id]', // Generic
      '.product-gallery img', // Very generic fallback
      '.product-featured-img', // Debut
    ];

    let items = [];

    for (const selector of selectors) {
      const found = document.querySelectorAll(selector);
      if (found.length > 0) {
        items = Array.from(found);
        break;
      }
    }

    // Fallback: look for images in product gallery container
    if (items.length === 0) {
      const galleryContainer = document.querySelector('.product-gallery, .product__media, [data-product-media]');
      if (galleryContainer) {
        items = Array.from(galleryContainer.querySelectorAll('img, video, model-viewer, iframe'));
      }
    }

    return items;
  }

  /**
   * Extract media ID from gallery item
   */
  function getMediaIdFromItem(item) {
    // Try data-media-id attribute
    const dataId = item.getAttribute('data-media-id');
    if (dataId) {
      return 'gid://shopify/' + (item.tagName === 'VIDEO' ? 'Video' : 'MediaImage') + '/' + dataId.replace(/^\D+/g, '');
    }

    // Try from src URL
    if (item.src) {
      const matches = item.src.match(/\/products\/.*?(_(\d+)\.(jpg|jpeg|png|webp)|\?v=(\d+))/);
      if (matches) {
        const id = matches[2] || matches[4];
        if (id) {
          return 'gid://shopify/MediaImage/' + id;
        }
      }
    }

    // Try from parent container
    const parent = item.closest('[data-media-id]');
    if (parent) {
      const parentId = parent.getAttribute('data-media-id');
      return 'gid://shopify/MediaImage/' + parentId.replace(/^\D+/g, '');
    }

    return null;
  }

  /**
   * Check if item is global media
   */
  function isGlobalMedia(item) {
    if (item.hasAttribute('data-spectra-global')) {
      return item.getAttribute('data-spectra-global') === 'true';
    }
    return false;
  }

  /**
   * Show gallery item
   */
  function showGalleryItem(item) {
    item.style.display = '';
    item.removeAttribute('hidden');
    item.classList.remove('spectra-hidden');
  }

  /**
   * Hide gallery item
   */
  function hideGalleryItem(item) {
    item.style.display = 'none';
    item.setAttribute('hidden', '');
    item.classList.add('spectra-hidden');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for potential external use
  window.SpectraGallery = {
    refresh: () => {
      currentVariantId = getSelectedVariantId();
      filterGallery(currentVariantId);
    },
    showVariant: (variantId) => {
      currentVariantId = variantId;
      filterGallery(variantId);
    }
  };
})();
