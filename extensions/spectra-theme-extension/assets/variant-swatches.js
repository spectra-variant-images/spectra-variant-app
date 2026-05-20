/**
 * Spectra Variant Swatches
 * Displays visual swatches for variant selection
 * Supports: color swatches, image swatches, button-style selectors
 */

(function() {
  'use strict';

  // Metafield namespace and keys
  const METAFIELD_NAMESPACE = 'spectra';
  const SWATCH_COLOR_KEY = 'swatch_color_hex';
  const SWATCH_IMAGE_KEY = 'swatch_image_gid';
  const PRIMARY_OPTION_KEY = 'primary_option';

  // Configuration (will be overridden by extension settings)
  let config = {
    shape: 'circle',
    size: 'medium',
    customSize: 32,
    showOutOfStock: true,
    outOfStockStyle: 'cross_out',
    showLowStockBadge: false,
    lowStockThreshold: 5
  };

  // State
  let productData = null;
  let variantInventory = new Map();
  let swatchMetafields = new Map();

  /**
   * Initialize swatches
   */
  function init() {
    loadConfig();
    loadProductData();

    if (!productData) {
      console.debug('[Spectra Swatches] No product data available');
      return;
    }

    loadInventoryData();
    loadSwatchMetafields();
    injectSwatches();
    setupEventListeners();
  }

  /**
   * Load extension configuration
   */
  function loadConfig() {
    const configEl = document.querySelector('[data-spectra-config]');
    if (configEl) {
      try {
        const data = JSON.parse(configEl.textContent);
        config = { ...config, ...data };
      } catch (e) {
        console.warn('[Spectra Swatches] Failed to parse config', e);
      }
    }
  }

  /**
   * Load product data
   */
  function loadProductData() {
    // Try multiple sources
    const sources = [
      () => window.product,
      () => window.ShopifyAnalytics?.meta?.product,
      () => {
        const el = document.querySelector('[data-product-json]');
        return el ? JSON.parse(el.textContent) : null;
      }
    ];

    for (const source of sources) {
      try {
        const data = source();
        if (data && data.variants) {
          productData = data;
          return;
        }
      } catch (e) {}
    }
  }

  /**
   * Load inventory data for variants
   */
  function loadInventoryData() {
    if (!productData.variants) return;

    productData.variants.forEach(variant => {
      variantInventory.set(variant.id, {
        available: variant.available,
        inventoryQuantity: variant.inventory_quantity || 0,
        inventoryPolicy: variant.inventory_policy
      });
    });
  }

  /**
   * Load swatch metafields
   */
  function loadSwatchMetafields() {
    if (!productData.metafields) return;

    const spectraMetafields = productData.metafields[METAFIELD_NAMESPACE] || {};

    // Store swatch configurations
    Object.keys(spectraMetafields).forEach(key => {
      if (key.startsWith('variant_')) {
        const variantId = key.replace('variant_', '');
        swatchMetafields.set(variantId, spectraMetafields[key]);
      }
    });
  }

  /**
   * Inject swatches into the DOM
   */
  function injectSwatches() {
    const primaryOption = getPrimaryOption();
    const optionIndex = getOptionIndex(primaryOption);

    if (optionIndex === -1) {
      console.debug('[Spectra Swatches] Primary option not found');
      return;
    }

    // Find or create swatch container
    const container = findOrCreateSwatchContainer(optionIndex);

    // Generate unique option values for this option
    const optionValues = getOptionValues(optionIndex);

    // Clear existing swatches
    container.innerHTML = '';

    // Create swatches
    optionValues.forEach(value => {
      const swatch = createSwatch(value, optionIndex);
      container.appendChild(swatch);
    });

    // Select initially active swatch
    selectInitialSwatch(container, optionIndex);
  }

  /**
   * Get primary option for swatches
   */
  function getPrimaryOption() {
    // Check metafield
    if (productData.metafields?.[METAFIELD_NAMESPACE]?.[PRIMARY_OPTION_KEY]) {
      return productData.metafields[METAFIELD_NAMESPACE][PRIMARY_OPTION_KEY];
    }

    // Auto-detect: first option with color-like values
    const optionNames = productData.options || [];
    const colorKeywords = ['color', 'colour', 'shade', 'finish', 'material', 'pattern'];

    for (const name of optionNames) {
      if (colorKeywords.some(keyword => name.toLowerCase().includes(keyword))) {
        return name;
      }
    }

    // Default to first option
    return optionNames[0] || 'Color';
  }

  /**
   * Get index of an option by name
   */
  function getOptionIndex(optionName) {
    const options = productData.options || [];
    return options.findIndex(opt => opt === optionName);
  }

  /**
   * Get unique values for an option
   */
  function getOptionValues(optionIndex) {
    const values = new Set();

    productData.variants.forEach(variant => {
      if (variant.options && variant.options[optionIndex]) {
        values.add(variant.options[optionIndex]);
      }
    });

    return Array.from(values);
  }

  /**
   * Find or create swatch container
   */
  function findOrCreateSwatchContainer(optionIndex) {
    const optionName = productData.options[optionIndex];
    const cssSafeName = optionName.toLowerCase().replace(/\s+/g, '-');

    // Try existing container
    let container = document.querySelector(`[data-spectra-swatches="${cssSafeName}"]`);

    if (!container) {
      // Find native selector to replace
      const nativeSelector = document.querySelector(
        `.variant-wrapper[data-option="${optionName}"] .single-option-selector,`
        + `.selector-wrapper[data-option="${optionName}"] select,`
        + `.product-form__input[data-option="${optionName}"] select`
      );

      container = document.createElement('div');
      container.className = `spectra-swatches spectra-swatches--${config.shape} spectra-swatches--${config.size}`;
      container.setAttribute('data-spectra-swatches', cssSafeName);
      container.setAttribute('data-option-position', optionIndex + 1);

      if (nativeSelector) {
        nativeSelector.parentNode.replaceChild(container, nativeSelector);
      } else {
        // Create new container and inject after product title
        const productTitle = document.querySelector('.product__title, h1.product-single__title, .product-info h1');
        if (productTitle) {
          productTitle.parentNode.insertBefore(container, productTitle.nextSibling);
        }
      }
    }

    return container;
  }

  /**
   * Create a single swatch element
   */
  function createSwatch(value, optionIndex) {
    const swatch = document.createElement('button');
    swatch.className = 'spectra-swatch';
    swatch.setAttribute('data-value', value);
    swatch.setAttribute('data-option-position', optionIndex + 1);
    swatch.setAttribute('type', 'button');
    swatch.setAttribute('aria-label', value);

    // Get variants for this swatch value
    const variants = getVariantsForValue(value, optionIndex);
    const firstVariant = variants[0];

    // Determine swatch type and styling
    const swatchStyle = getSwatchStyle(value, firstVariant);
    applySwatchStyle(swatch, swatchStyle);

    // Check availability
    const availableVariant = findAvailableVariant(variants);
    const isAvailable = !!availableVariant;

    if (!isAvailable) {
      swatch.classList.add('spectra-swatch--unavailable');
      applyOutOfStockStyle(swatch);

      const inventory = variantInventory.get(firstVariant.id);
      if (config.showLowStockBadge && inventory && inventory.inventoryQuantity > 0 && inventory.inventoryQuantity <= config.lowStockThreshold) {
        const badge = document.createElement('span');
        badge.className = 'spectra-swatch__badge';
        badge.textContent = inventory.inventoryQuantity;
        swatch.appendChild(badge);
      }
    }

    // Tool tip
    const tooltip = document.createElement('span');
    tooltip.className = 'spectra-swatch__tooltip';
    tooltip.textContent = value;
    swatch.appendChild(tooltip);

    // Click handler
    swatch.addEventListener('click', (e) => {
      e.preventDefault();
      selectSwatch(swatch, availableVariant || firstVariant, optionIndex);
    });

    return swatch;
  }

  /**
   * Get styling info for a swatch
   */
  function getSwatchStyle(value, variant) {
    const style = { type: 'button', label: value };

    // Check metafields for this variant
    const variantMeta = swatchMetafields.get(variant.id);

    if (variantMeta) {
      if (variantMeta[SWATCH_COLOR_KEY]) {
        style.type = 'color';
        style.color = variantMeta[SWATCH_COLOR_KEY];
      }
      if (variantMeta[SWATCH_IMAGE_KEY]) {
        style.type = 'image';
        style.image = variantMeta[SWATCH_IMAGE_KEY];
      }
    }

    // Try to infer color from value name
    if (style.type === 'button') {
      const colorName = getColorFromName(value);
      if (colorName) {
        style.type = 'color';
        style.color = colorName;
      }
    }

    // Try to use variant image
    if (style.type === 'button' && variant?.featured_image) {
      style.type = 'image';
      style.image = variant.featured_image;
    }

    return style;
  }

  /**
   * Get color hex from color name
   */
  function getColorFromName(name) {
    const colorMap = {
      'red': '#E53935',
      'blue': '#1E88E5',
      'green': '#43A047',
      'yellow': '#FDD835',
      'orange': '#FB8C00',
      'purple': '#8E24AA',
      'pink': '#D81B60',
      'brown': '#6D4C41',
      'black': '#212121',
      'white': '#FFFFFF',
      'gray': '#757575',
      'grey': '#757575',
      'navy': '#1A237E',
      'olive': '#558B2F',
      'maroon': '#880E4F',
      'teal': '#00897B',
      'cyan': '#00ACC1',
      'lime': '#C0CA33',
      'indigo': '#3949AB',
      'violet': '#5E35B1',
      'peach': '#FFAB91',
      'coral': '#FF7043',
      'gold': '#FFD700',
      'silver': '#C0C0C0',
      'beige': '#F5F5DC',
      'cream': '#FFFDD0',
      'ivory': '#FFFFF0',
      'tan': '#D2B48C',
      'khaki': '#C3B091',
      'lavender': '#E6E6FA',
      'mint': '#98FF98',
      'turquoise': '#40E0D0',
      'burgundy': '#800020'
    };

    const lowerName = name.toLowerCase().replace(/[^a-z]/g, '');
    return colorMap[lowerName] || null;
  }

  /**
   * Apply visual style to swatch
   */
  function applySwatchStyle(swatch, style) {
    if (style.type === 'color') {
      swatch.style.backgroundColor = style.color;
      if (style.color === '#FFFFFF' || style.color === '#FFFDD0' || style.color === '#FFFFF0') {
        swatch.style.border = '1px solid #ddd';
      }
    } else if (style.type === 'image') {
      swatch.style.backgroundImage = `url(${style.image})`;
      swatch.style.backgroundSize = 'cover';
      swatch.style.backgroundPosition = 'center';
    } else {
      swatch.textContent = style.label;
      swatch.classList.add('spectra-swatch--button');
    }
  }

  /**
   * Apply out of stock styling
   */
  function applyOutOfStockStyle(swatch) {
    if (!config.showOutOfStock) {
      swatch.style.display = 'none';
      return;
    }

    switch (config.outOfStockStyle) {
      case 'hide':
        swatch.style.display = 'none';
        break;
      case 'cross_out':
        swatch.classList.add('spectra-swatch--crossed');
        break;
      case 'show_label':
        const label = document.createElement('span');
        label.className = 'spectra-swatch__sold-out';
        label.textContent = 'Sold out';
        swatch.appendChild(label);
        break;
    }
  }

  /**
   * Get all variants for a given option value
   */
  function getVariantsForValue(value, optionIndex) {
    return productData.variants.filter(v => v.options && v.options[optionIndex] === value);
  }

  /**
   * Find an available variant for a value
   */
  function findAvailableVariant(variants) {
    return variants.find(v => v.available);
  }

  /**
   * Select initial swatch based on current variant
   */
  function selectInitialSwatch(container, optionIndex) {
    const selectedVariant = getSelectedVariant();
    if (!selectedVariant) return;

    const selectedValue = selectedVariant.options[optionIndex];
    const swatch = container.querySelector(`[data-value="${selectedValue}"]`);

    if (swatch) {
      swatch.classList.add('spectra-swatch--active');
    }
  }

  /**
   * Get currently selected variant
   */
  function getSelectedVariant() {
    const urlParams = new URLSearchParams(window.location.search);
    const variantId = urlParams.get('variant');

    if (variantId) {
      return productData.variants.find(v => v.id == variantId);
    }

    // Try form input
    const input = document.querySelector('input[name="id"]');
    if (input) {
      return productData.variants.find(v => v.id == input.value);
    }

    return productData.variants.find(v => v.available);
  }

  /**
   * Handle swatch selection
   */
  function selectSwatch(swatch, variant, optionIndex) {
    // Update active state
    const container = swatch.parentNode;
    container.querySelectorAll('.spectra-swatch').forEach(s => {
      s.classList.remove('spectra-swatch--active');
    });
    swatch.classList.add('spectra-swatch--active');

    // Trigger variant change
    triggerVariantChange(variant);

    // Sync with other options
    syncOtherOptions(variant, optionIndex);
  }

  /**
   * Trigger variant selection in the form
   */
  function triggerVariantChange(variant) {
    // Update hidden input
    const input = document.querySelector('input[name="id"]');
    if (input) {
      input.value = variant.id;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url);

    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('spectra:variant-changed', {
      detail: { variant }
    }));
  }

  /**
   * Sync other option selects
   */
  function syncOtherOptions(variant, changedOptionIndex) {
    productData.options.forEach((option, index) => {
      if (index === changedOptionIndex) return;

      const value = variant.options[index];
      const select = document.querySelector(`select[name="options[${option}]"], .single-option-selector[data-index="option${index + 1}"]`);

      if (select) {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Listen for external variant changes
    document.addEventListener('variant:change', (e) => {
      const variant = e.detail.variant;
      if (variant) {
        updateSwatchesForVariant(variant);
      }
    });

    // Listen for URL changes
    const observer = new MutationObserver(() => {
      const variant = getSelectedVariant();
      if (variant) {
        updateSwatchesForVariant(variant);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Update swatches when variant changes externally
   */
  function updateSwatchesForVariant(variant) {
    productData.options.forEach((option, index) => {
      const value = variant.options[index];
      const container = document.querySelector(`[data-spectra-swatches]`);
      const swatches = container?.querySelectorAll('.spectra-swatch');

      swatches?.forEach(swatch => {
        if (swatch.getAttribute('data-value') === value) {
          swatch.classList.add('spectra-swatch--active');
        } else {
          swatch.classList.remove('spectra-swatch--active');
        }
      });
    });
  }

  // Inject CSS styles
  injectStyles();

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /**
   * Inject CSS for swatches
   */
  function injectStyles() {
    const css = `
      .spectra-swatches {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 16px 0;
      }

      .spectra-swatch {
        position: relative;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0;
        padding: 0;
      }

      .spectra-swatch:focus {
        outline: 2px solid #008060;
        outline-offset: 2px;
      }

      .spectra-swatch--circle { border-radius: 50%; }
      .spectra-swatch--square { border-radius: 4px; }
      .spectra-swatch--rounded { border-radius: 8px; }

      .spectra-swatches--small .spectra-swatch { width: 24px; height: 24px; }
      .spectra-swatches--medium .spectra-swatch { width: 32px; height: 32px; }
      .spectra-swatches--large .spectra-swatch { width: 40px; height: 40px; }

      .spectra-swatch--active {
        border-color: #000;
        box-shadow: 0 0 0 2px rgba(0,0,0,0.1);
      }

      .spectra-swatch:hover:not(.spectra-swatch--unavailable) {
        transform: scale(1.1);
      }

      .spectra-swatch--unavailable {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .spectra-swatch--crossed::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 70%;
        height: 2px;
        background: #000;
        transform: translate(-50%, -50%) rotate(45deg);
      }

      .spectra-swatch--button {
        min-width: 50px;
        padding: 8px 16px;
        font-size: 14px;
        background: #f6f6f6;
        border: 1px solid #ddd;
      }

      .spectra-swatch__tooltip {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        padding: 4px 8px;
        background: #000;
        color: #fff;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        margin-bottom: 4px;
      }

      .spectra-swatch:hover .spectra-swatch__tooltip {
        opacity: 1;
      }

      .spectra-swatch__badge {
        position: absolute;
        top: -8px;
        right: -8px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        background: #E53935;
        color: #fff;
        font-size: 10px;
        line-height: 18px;
        text-align: center;
        border-radius: 9px;
        font-weight: bold;
      }

      .spectra-swatch__sold-out {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: #E53935;
        color: #fff;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
      }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Export
  window.SpectraSwatches = {
    refresh: injectSwatches
  };
})();
