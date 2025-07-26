class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0, event);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      return this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        CartPerformance.measure(`${eventTarget}:paint-updated-sections"`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          this.getSectionsToRender().forEach((section) => {
            const elementToReplace =
              document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
          });
          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        });

        CartPerformance.measureFromEvent(`${eventTarget}:user-action`, event);

        // 🔥
        const updatedCartTotal = parsedState.total_price;
        this.updateProgressBar(updatedCartTotal);

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  // 🔥
  updateProgressBar(cartTotalCents) {
    const progressWrapper = document.getElementById('cart-progress-wrapper');
    if (!progressWrapper) return;

    const currencyFormat = progressWrapper.dataset.currencyFormat;
    const thresholds = progressWrapper.dataset.thresholds.split(',').map(Number);
    const preGoalMessages = progressWrapper.dataset.preGoalMessages.split('||');
    const postGoalMessages = progressWrapper.dataset.postGoalMessages.split('||');
    const goalPositions = progressWrapper.dataset.goalPositions.split(',').map(Number);

    const totalThreshold = thresholds[thresholds.length - 1];
    const progressPercentage = Math.min((cartTotalCents / totalThreshold) * 100, 100);

    const progressBar = document.getElementById('cart-progress-bar');
    const goalIcons = document.querySelectorAll('.goal-icon');
    const goalMessageElement = document.querySelector('.goal-message');

    if (cartTotalCents === 0) {
      progressWrapper.style.display = 'none';
      goalMessageElement.style.display = 'none';
      progressBar.style.width = '0%'; 
    } else {
      progressWrapper.style.display = 'block';
      const previousWidth = parseFloat(progressBar.style.width) || 0;
      progressBar.style.width = `${progressPercentage}%`;

      if (progressPercentage >= 100) {
        progressWrapper.classList.add('full');
      } else {
        progressWrapper.classList.remove('full');
      }

      let nextGoalIndex = -1;
      for (let i = 0; i < thresholds.length; i++) {
        if (cartTotalCents < thresholds[i]) {
          nextGoalIndex = i;
          break;
        }
      }

      goalIcons.forEach((goalIcon, index) => {
        const cartTotalDiff = cartTotalCents - thresholds[index];
        const icon = goalIcon.querySelector('img');
        const goalNumber = goalIcon.dataset.index;
        
        if (icon) {
          if (cartTotalDiff < 0) {
            const regularIconUrl = goalIcon.dataset.regularIcon;
            if (regularIconUrl) {
              icon.src = regularIconUrl;
              icon.srcset = `${regularIconUrl} 50w`;
              icon.alt = `Goal ${goalNumber}`;
            }
          } else {
            const reachedIconUrl = goalIcon.dataset.reachedIcon;
            if (reachedIconUrl) {
              icon.src = reachedIconUrl;
              icon.srcset = `${reachedIconUrl} 50w`;
              icon.alt = `Goal ${goalNumber} Reached`;
            }
          }
        }
      });

      goalMessageElement.style.display = 'block';
      if (nextGoalIndex === -1) {
        const message = postGoalMessages[postGoalMessages.length - 1];
        goalMessageElement.innerHTML = message;
      } else {
        const remainingForGoal = thresholds[nextGoalIndex] - cartTotalCents;
        const remainingAmount = remainingForGoal / 100;
        const remainingAmountFormatted = this.formatCurrency(currencyFormat, remainingAmount);
        const preGoalMessageTemplate = preGoalMessages[nextGoalIndex];
        const message = preGoalMessageTemplate.replace('[remaining_for_goal]', remainingAmountFormatted);
        goalMessageElement.innerHTML = message;
      }
    }
  }

  formatCurrency(currencyFormat, amount) {
    let formattedAmount = '';
    formattedAmount = currencyFormat
      .replace('{{amount}}', amount.toFixed(2)) // Standard with two decimals
      .replace('{{amount_no_decimals}}', amount.toFixed(0)) // No decimals
      .replace('{{amount_with_comma_separator}}', amount.toFixed(2).replace('.', ',')) // Replace period with comma
      .replace('{{amount_no_decimals_with_comma_separator}}', amount.toFixed(0).replace('.', ',')) // No decimals, use comma
      .replace('{{amount_with_apostrophe_separator}}', amount.toFixed(2).replace('.', "'")) // Apostrophe separator
      .replace('{{amount_no_decimals_with_space_separator}}', amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) // No decimals, space
      .replace('{{amount_with_space_separator}}', amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('.', ',')) // Space separator
      .replace('{{amount_with_period_and_space_separator}}', amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')); // Period and space
    return formattedAmount;
  }
  // 🔥 end

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
              .then(() => CartPerformance.measureFromEvent('note-update:user-action', event));
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}
