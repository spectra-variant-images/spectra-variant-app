/**
 * Spectra Collection Page Swatches
 * Shows variant swatches on collection/search pages
 * Updates product card image on hover/click
 */

(function() {
  'use strict';

  const METAFIELD_NAMESPACE = 'spectra';
  const SWATCH_COLOR_KEY = 'swatch_color_hex';
  const SWATCH_IMAGE_KEY = 'swatch_image_gid';

  let config = {
    shape: 'circle',
    size: 'small',
    hoverUpdate: true,
    showQuantity: false
  };

  /**
   * Initialize collection swatches
   */
  function init() {
    // Only run on collection/search pages
    if (!isCollectionPage()) {
      return;
    }

    loadConfig();
    injectSwatches();
  }

  /**
   * Check if we're on a collection/search page
   */
  function isCollectionPage() {
    const template = document.body.getAttribute('data-template');
    const templateClass = document.body.classList.toString();

    return /collection|search|index/.test(template + templateClass);
  }

  /**
   * Load configuration
   */
  function loadConfig() {
    const configEl = document.querySelector('[data-spectra-collection-config]');
    if (configEl) {
      try {
        const data = JSON.parse(configEl.textContent);
        config = { ...config, ...data };
      } catch (e) {}
    }
  }

  /**
   * Inject swatches into product cards
   */
  function injectSwatches() {
    const productCards = getProductCards();

    productCards.forEach(card => {
      const productId = getProductId(card);
      if (!productId) return;

      // Get swatch data from liquid-injected attribute
      const swatchData = getSwatchData(card, productId);
      if (!swatchData || swatchData.length === 0) return;

      // Create swatches container
      const container = createSwatchesContainer(swatchData, card);
      card.appendChild(container);
    });
  }

  /**
   * Get all product cards on the page
   */
  function getProductCards() {
    const selectors = [
      '.product-item', // Debut, Dawn
      '.grid-item', // Many themes
      '.product-card', // Common
      '.product-block', // Some themes
      '[data-product-card]', // Semantic
      '.collection-product-item'
    ];

    for (const selector of selectors) {
      const items = document.querySelectorAll(selector);
      if (items.length > 0) {
        return Array.from(items);
      }
    }

    // Fallback: look for products in main grid
    const grid = document.querySelector('.product-grid, .collection-grid, .grid--view-items');
    return grid ? Array.from(grid.children) : [];
  }

  /**
   * Extract product ID from card
   */
  function getProductId(card) {
    // Try data attribute
    let id = card.getAttribute('data-product-id');
    if (id) return id;

    // Try from link
    const link = card.querySelector('a[href*="/products/"]');
    if (link) {
      const match = link.href.match(/\/products\/([^\?\/]+)/);
      if (match) {
        // Try to find product ID in data attributes of nearby elements
        const idEl = card.querySelector('[data-product-id]');
        if (idEl) return idEl.getAttribute('data-product-id');
      }
    }

    return null;
  }

  /**
   * Get swatch data for a product card
   */
  function getSwatchData(card, productId) {
    // Try data attribute (injected by liquid)
    const dataEl = card.querySelector('[data-spectra-product-swatches]');
    if (dataEl) {
      try {
        return JSON.parse(dataEl.textContent);
      } catch (e) {}
    }

    // Try to find variant data from script tag
    const script = card.querySelector('script[type="application/json"]');
    if (script) {
      try {
        const data = JSON.parse(script.textContent);
        if (data.variants) {
          return formatVariantsAsSwatches(data.variants);
        }
      } catch (e) {}
    }

    return [];
  }

  /**
   * Format variant data as swatches
   */
  function formatVariantsAsSwatches(variants) {
    const colorOptions = new Map();

    variants.forEach(variant => {
      if (!variant.options) return;

      // Find color option (usually first option)
      const colorValue = variant.options[0];
      if (!colorValue) return;

      if (!colorOptions.has(colorValue)) {
        colorOptions.set(colorValue, {
          value: colorValue,
          variantId: variant.id,
          available: variant.available,
          image: variant.featured_image,
          inventoryQuantity: variant.inventory_quantity
        });
      }
    });

    return Array.from(colorOptions.values());
  }

  /**
   * Create swatches container for a product card
   */
  function createSwatchesContainer(swatchData, card) {
    const container = document.createElement('div');
    container.className = 'spectra-collection-swatches';
    container.setAttribute('data-product-id', getProductId(card));

    swatchData.forEach(data => {
      const swatch = createCollectionSwatch(data, card);
      container.appendChild(swatch);
    });

    return container;
  }

  /**
   * Create a single collection swatch
   */
  function createCollectionSwatch(data, card) {
    const swatch = document.createElement('button');
    swatch.className = `spectra-collection-swatch spectra-collection-swatch--${config.shape}`;
    swatch.setAttribute('data-variant-id', data.variantId);
    swatch.setAttribute('data-value', data.value);
    swatch.setAttribute('type', 'button');
    swatch.setAttribute('aria-label', data.value);

    // Apply color/image
    if (data.color) {
      swatch.style.backgroundColor = data.color;
    } else if (data.image) {
      swatch.style.backgroundImage = `url(${data.image})`;
      swatch.style.backgroundSize = 'cover';
      swatch.style.backgroundPosition = 'center';
    } else {
      // Try to infer color from name
      const color = getColorFromName(data.value);
      if (color) {
        swatch.style.backgroundColor = color;
      }
    }

    // Quantity badge
    if (config.showQuantity && data.inventoryQuantity !== undefined) {
      const badge = document.createElement('span');
      badge.className = 'spectra-collection-swatch__qty';
      badge.textContent = data.inventoryQuantity;
      badge.style.display = data.inventoryQuantity > 0 ? 'block' : 'none';
      swatch.appendChild(badge);
    }

    // Out of stock styling
    if (!data.available) {
      swatch.classList.add('spectra-collection-swatch--unavailable');
    }

    // Hover/click handler
    if (config.hoverUpdate && data.image) {
      swatch.addEventListener('mouseenter', () => updateCardImage(card, data.image));
      swatch.addEventListener('mouseleave', () => resetCardImage(card));
      swatch.addEventListener('click', () => updateCardImage(card, data.image));
    }

    return swatch;
  }

  /**
   * Get color hex from name
   */
  function getColorFromName(name) {
    const colorMap = {
      'red': '#E53935', 'blue': '#1E88E5', 'green': '#43A047',
      'yellow': '#FDD835', 'orange': '#FB8C00', 'purple': '#8E24AA',
      'pink': '#D81B60', 'black': '#212121', 'white': '#FFFFFF',
      'gray': '#757575', 'grey': '#757575', 'navy': '#1A237E',
      'brown': '#6D4C41', 'beige': '#F5F5DC', 'gold': '#FFD700',
      'silver': '#C0C0C0', 'cream': '#FFFDD0', 'tan': '#D2B48C',
      'maroon': '#800020', 'teal': '#00897B', 'coral': '#FF7043',
      'olive': '#558B2F', 'lavender': '#E6E6FA', 'mint': '#98FF98'
    };

    const lowerName = name.toLowerCase().replace(/[^a-z]/g, '');
    return colorMap[lowerName];
  }

  /**
   * Update product card image on hover
   */
  function updateCardImage(card, imageUrl) {
    const img = card.querySelector('img');
    if (img) {
      // Store original for reset
      if (!img.hasAttribute('data-spectra-original')) {
        img.setAttribute('data-spectra-original', img.src);
      }
      img.src = imageUrl;
    }
  }

  /**
   * Reset product card to original image
   */
  function resetCardImage(card) {
    const img = card.querySelector('img');
    if (img && img.hasAttribute('data-spectra-original')) {
      img.src = img.getAttribute('data-spectra-original');
    }
  }

  // Inject CSS
  injectCollectionStyles();

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /**
   * Inject collection swatches CSS
   */
  function injectCollectionStyles() {
    const css = `
      .spectra-collection-swatches {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
        justify-content: flex-start;
      }

      .spectra-collection-swatch {
        width: 16px;
        height: 16px;
        border: 1px solid rgba(0,0,0,0.1);
        cursor: pointer;
        padding: 0;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        position: relative;
      }

      .spectra-collection-swatch--circle { border-radius: 50%; }
      .spectra-collection-swatch--square { border-radius: 2px; }
      .spectra-collection-swatch--rounded { border-radius: 4px; }

      .spectra-collection-swatch:hover {
        transform: scale(1.15);
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      }

      .spectra-collection-swatch--unavailable {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .spectra-collection-swatch--unavailable::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 60%;
        height: 1px;
        background: #000;
        transform: translate(-50%, -50%) rotate(45deg);
      }

      .spectra-collection-swatch__qty {
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 14px;
        height: 14px;
        padding: 0 3px;
        background: #1E88E5;
        color: #fff;
        font-size: 9px;
        line-height: 14px;
        text-align: center;
        border-radius: 7px;
        font-weight: bold;
      }

      @media (max-width: 768px) {
        .spectra-collection-swatches {
          justify-content: center;
        }
      }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Export
  window.SpectraCollectionSwatches = {
    refresh: injectSwatches
  };
})();
