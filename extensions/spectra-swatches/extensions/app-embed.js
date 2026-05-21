(function() {
  'use strict';

  const CONFIG = {
    style: '{{ settings.swatch_style | default: "round" }}',
    size: {{ settings.swatch_size | default: 32 }},
    enableProduct: {{ settings.enable_product_page | default: true }},
    enableCollection: {{ settings.enable_collection_page | default: true }},
    limitCollectionSwatches: {{ settings.limit_collection_swatches | default: 5 }}
  };

  // Get product data from metafields (injected by Liquid)
  const getProductData = () => {
    const el = document.getElementById('SpectraProductData');
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  };

  // Get collection swatch data
  const getCollectionSwatches = (container) => {
    const swatchEls = container.querySelectorAll('[data-spectra-swatch]');
    const swatches = [];
    swatchEls.forEach(el => {
      swatches.push({
        variantId: el.dataset.variantId,
        color: el.dataset.color,
        image: el.dataset.image
      });
    });
    return swatches;
  };

  // Create swatch element
  const createSwatch = (variant, style, size) => {
    const swatch = document.createElement('button');
    swatch.className = `spectra-swatch spectra-swatch--${style}`;
    swatch.setAttribute('aria-label', variant.displayName || variant.title);
    swatch.dataset.variantId = variant.id;
    swatch.dataset.color = variant.swatch?.color || '';
    swatch.dataset.image = variant.swatch?.image || '';

    if (variant.swatch?.color) {
      swatch.style.backgroundColor = variant.swatch.color;
    } else if (variant.swatch?.image) {
      swatch.style.backgroundImage = `url(${variant.swatch.image})`;
      swatch.style.backgroundSize = 'cover';
    } else {
      swatch.textContent = variant.title;
      swatch.style.fontSize = '10px';
    }

    swatch.style.width = `${size}px`;
    swatch.style.height = `${size}px`;

    return swatch;
  };

  // Inject swatches on product page
  const injectProductSwatches = () => {
    const productData = getProductData();
    if (!productData || !productData.variants) return;

    // Find variant picker
    const picker = document.querySelector('.product-variant-picker, [data-variant-inputs], .variant-wrapper');
    if (!picker) return;

    // Determine which option is visual (color)
    const visualOption = productData.options?.find((o, i) => {
      return productData.variants.some(v => v.swatch && v.optionValues[i]);
    });

    if (!visualOption) return;

    // Create swatch container
    const container = document.createElement('div');
    container.className = 'spectra-swatches-container';
    container.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    `;

    // Group variants by visual option value
    const variantGroups = {};
    productData.variants.forEach(variant => {
      const optionValue = variant.optionValues?.[visualOption.position - 1];
      if (optionValue) {
        if (!variantGroups[optionValue]) {
          variantGroups[optionValue] = [];
        }
        variantGroups[optionValue].push(variant);
      }
    });

    // Create swatches
    Object.keys(variantGroups).forEach(optionValue => {
      const variants = variantGroups[optionValue];
      const representative = variants[0];

      if (representative.swatch || !representative.swatch?.color) {
        const swatch = createSwatch(representative, CONFIG.style, CONFIG.size);

        swatch.addEventListener('click', () => {
          // Select the first available variant with this option
          const availableVariant = variants.find(v => v.available) || variants[0];
          if (availableVariant.id) {
            // Trigger variant selection
            const variantInput = document.querySelector(`input[value="${availableVariant.id}"]`);
            if (variantInput) {
              variantInput.click();
            } else {
              // Fallback: dispatch custom event
              document.dispatchEvent(new CustomEvent('spectra:variant-change', {
                detail: { variantId: availableVariant.id }
              }));
            }
          }
        });

        container.appendChild(swatch);
      }
    });

    // Insert swatches after the color option picker
    const colorOption = picker.querySelector(`legend:contains('Color'), label:contains('Color'), .variant-label:contains('Color')`);
    if (colorOption) {
      colorOption.parentNode.insertBefore(container, colorOption.nextSibling);
    }
  };

  // Inject swatches on collection page
  const injectCollectionSwatches = () => {
    const productCards = document.querySelectorAll('.product-card, .product-item, [data-product-card]');

    productCards.forEach(card => {
      const productId = card.dataset.productId || card.querySelector('[data-product-id]')?.dataset.productId;
      if (!productId) return;

      const swatchContainer = card.querySelector('.spectra-collection-swatches');
      if (swatchContainer) return; // Already injected

      const container = document.createElement('div');
      container.className = 'spectra-collection-swatches';
      container.style.cssText = `
        display: flex;
        gap: 4px;
        margin-top: 8px;
      `;

      // Get swatches from data attribute or fetch
      const swatchesJson = card.dataset.spectraSwatches;
      let swatches = [];

      if (swatchesJson) {
        try {
          swatches = JSON.parse(swatchesJson);
        } catch (e) {}
      }

      swatches.slice(0, CONFIG.limitCollectionSwatches).forEach(swatch => {
        const btn = document.createElement('button');
        btn.className = `spectra-swatch spectra-swatch--${CONFIG.style}`;
        btn.style.cssText = `
          width: 20px;
          height: 20px;
          border: 1px solid #e1e3e5;
          cursor: pointer;
        `;

        if (swatch.color) {
          btn.style.backgroundColor = swatch.color;
        } else if (swatch.image) {
          btn.style.backgroundImage = `url(${swatch.image})`;
          btn.style.backgroundSize = 'cover';
        }

        btn.addEventListener('mouseenter', () => {
          if (CONFIG.hoverToChange && swatch.image) {
            const img = card.querySelector('img');
            if (img) img.src = swatch.image;
          }
        });

        container.appendChild(btn);
      });

      const cardFooter = card.querySelector('.product-card-footer, .product-info');
      if (cardFooter) {
        cardFooter.appendChild(container);
      }
    });
  };

  // Initialize
  const init = () => {
    if (CONFIG.enableProduct) {
      injectProductSwatches();
    }
    if (CONFIG.enableCollection) {
      injectCollectionSwatches();
    }
  };

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also run after Shopify section loads (for dynamic sections)
  document.addEventListener('shopify:section:load', init);

})();
