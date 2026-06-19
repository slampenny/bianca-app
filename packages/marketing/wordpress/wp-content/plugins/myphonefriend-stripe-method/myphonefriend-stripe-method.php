<?php
/**
 * Plugin Name: MyPhoneFriend Stripe Payment Method
 * Description: Handles Stripe payment method integration via shortcode, including settings and rewrite rules.
 * Version: 1.8
 * Author: Jordan (Updated by AI)
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// =========================================================================
// Settings Page for Stripe API Keys (No Changes)
// =========================================================================
/**
 * Add the options page under the Settings menu.
 */
function mpf_stripe_add_settings_page() {
    add_options_page(
        'MyPhoneFriend Stripe Settings', // Page title
        'MyPhoneFriend Stripe',          // Menu title
        'manage_options',                // Capability required
        'myphonefriend-stripe-settings', // Menu slug
        'mpf_stripe_render_settings_page' // Function to display the page
    );
}
add_action('admin_menu', 'mpf_stripe_add_settings_page');

function mpf_stripe_allow_iframe_for_payment_page() {
    if (is_page('payment-method') && get_query_var('orgid') && get_query_var('token')) {
        // Remove X-Frame-Options header
        header_remove('X-Frame-Options');
        
        // Allow your app domain and mobile origins
        $allowed_origins = [
            'https://app.biancawellness.com',
            'file://', // for iOS WebView
            'http://localhost', // for Android WebView
        ];
        
        // Set CSP to allow your app to embed this page
        header("Content-Security-Policy: frame-ancestors 'self' " . implode(' ', $allowed_origins) . ";");
        
        // Add CORS headers
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (in_array($origin, $allowed_origins) || strpos($origin, 'file://') === 0) {
            header("Access-Control-Allow-Origin: " . $origin);
            header("Access-Control-Allow-Credentials: true");
        }
    }
}
add_action('send_headers', 'mpf_stripe_allow_iframe_for_payment_page', 100);

// Move the problematic code into a proper hook
function mpf_stripe_handle_payment_page_cache() {
    if (is_page('payment-method')) {
        wp_cache_flush();
    }
}
add_action('wp', 'mpf_stripe_handle_payment_page_cache');

/**
 * Register the settings needed for the plugin.
 */
function mpf_stripe_register_settings() {
    register_setting('mpf_stripe_settings_group', 'mpf_stripe_public_key');
    register_setting('mpf_stripe_settings_group', 'mpf_stripe_backend_url');
    add_settings_section('mpf_stripe_api_settings_section', 'Stripe API Configuration', 'mpf_stripe_settings_section_callback', 'myphonefriend-stripe-settings');
    add_settings_field('mpf_stripe_public_key_field', 'Stripe Public Key', 'mpf_stripe_public_key_render', 'myphonefriend-stripe-settings', 'mpf_stripe_api_settings_section');
    add_settings_field('mpf_stripe_backend_url_field', 'Backend API Base URL', 'mpf_stripe_backend_url_render', 'myphonefriend-stripe-settings', 'mpf_stripe_api_settings_section');
}
add_action('admin_init', 'mpf_stripe_register_settings');

/**
 * Callback function to render the description for the settings section.
 */
function mpf_stripe_settings_section_callback() {
    echo '<p>Enter your Stripe Public Key and the Base URL for your backend API operations.</p>';
}

/**
 * Callback function to render the Stripe Public Key input field.
 */
function mpf_stripe_public_key_render() {
    $value = get_option('mpf_stripe_public_key');
    echo '<input type="text" name="mpf_stripe_public_key" value="' . esc_attr($value) . '" style="width: 400px;" />';
    echo '<p class="description">Your publishable Stripe API key (e.g., pk_test_...).</p>';
}

/**
 * Callback function to render the Backend API Base URL input field.
 */
function mpf_stripe_backend_url_render() {
    $value = get_option('mpf_stripe_backend_url');
    echo '<input type="text" name="mpf_stripe_backend_url" value="' . esc_attr($value) . '" style="width: 400px;" placeholder="https://your-api.com" />';
     echo '<p class="description">The base URL for your server-side API (no trailing slash).</p>';
}

/**
 * Render the HTML for the settings page.
 */
function mpf_stripe_render_settings_page() {
    if (!current_user_can('manage_options')) { return; }
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
        <form action="options.php" method="post">
            <?php settings_fields('mpf_stripe_settings_group'); ?>
            <?php do_settings_sections('myphonefriend-stripe-settings'); ?>
            <?php submit_button('Save Settings'); ?>
        </form>
    </div>
    <?php
}


// =========================================================================
// Rewrite Rules for Payment Method Page (No Changes)
// =========================================================================
/**
 * Add custom rewrite rules for the payment method URL structure.
 */
function mpf_stripe_add_rewrite_rules($rules) {
    $new_rules = array(
        // Ensure this matches the slug of the page using the custom template
        'payment-method/([^/]+)/([^/]+)/?$' => 'index.php?pagename=payment-method&orgid=$matches[1]&token=$matches[2]',
    );
    return $new_rules + $rules;
}
add_filter('rewrite_rules_array', 'mpf_stripe_add_rewrite_rules');

/**
 * Add custom query variables so WordPress recognizes 'orgid' and 'token'.
 */
function mpf_stripe_add_query_vars($query_vars) {
    $query_vars[] = 'orgid';
    $query_vars[] = 'token';
    return $query_vars;
}
add_filter('query_vars', 'mpf_stripe_add_query_vars');

/**
 * Flush rewrite rules on plugin activation.
 */
function mpf_stripe_activate() {
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'mpf_stripe_activate');

/**
 * Flush rewrite rules on plugin deactivation.
 */
function mpf_stripe_deactivate() {
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'mpf_stripe_deactivate');


// =========================================================================
// Shortcode for Stripe Form
// =========================================================================

/**
 * Handles the [myphonefriend_payment_form] shortcode.
 * Outputs the Stripe payment form HTML, CSS, and JS.
 *
 * @param array $atts Shortcode attributes (not used currently).
 * @return string HTML output for the form.
 */
function mpf_stripe_payment_form_shortcode_handler($atts) {
    // Get Stripe settings and query variables
    $stripe_key = get_option('mpf_stripe_public_key');
    $api_base_url = get_option('mpf_stripe_backend_url');
    $orgId = get_query_var('orgid'); // Get 'orgid' from the URL
    $token = get_query_var('token'); // Get 'token' from the URL

    // Basic validation - ensure essential data is present
    // Shortcodes shouldn't output errors directly usually, but good to check.
    // Consider logging errors instead or returning a user-friendly message.
    if (empty($stripe_key) || empty($api_base_url) || empty($orgId) || empty($token)) {
         // Log the error for admin/debugging
         error_log('[MPF Stripe Plugin] Shortcode Error: Missing Stripe config or URL parameters (orgId, token).');
         // Return a user-facing message within the shortcode area
         return '<p style="color: red; text-align: center; padding: 20px; border: 1px solid red;">Configuration error or missing parameters in URL. Cannot display payment form.</p>';
    }

    // Sanitize data before outputting into JS/HTML
    $stripe_key_js = esc_js($stripe_key);
    $api_base_url_js = esc_url($api_base_url);
    $orgId_js = esc_js($orgId);
    $token_js = esc_js($token);

    // Start output buffering to capture the HTML, CSS, and JS
    ob_start();
    ?>
    <style>
        /* Embedded CSS for the Stripe Form */
        /* Ensure styles are self-contained and don't rely heavily on theme styles */
        .mpf-stripe-container { max-width: 500px; margin: 20px auto; /* Adjusted margin */ padding: 20px 30px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; /* Basic font stack */ }
        .mpf-page-title { text-align: center; margin-bottom: 30px; color: #333; font-size: 1.6em; /* Adjusted size */ font-weight: 600; }
        #mpf-payment-methods-list { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; min-height: 40px; }
        #mpf-payment-methods-list h3 { margin-top: 0; margin-bottom: 15px; font-size: 1.1em; color: #555; font-weight: 600; }
        #mpf-payment-methods-list div.payment-method-item { padding: 10px 0; border-bottom: 1px dashed #eee; display: flex; justify-content: space-between; align-items: center; font-size: 0.95em; }
        #mpf-payment-methods-list div.payment-method-item:last-child { border-bottom: none; }
        #mpf-payment-methods-list button { margin-left: 10px; padding: 5px 10px; font-size: 0.9em; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; background-color: #f8f8f8; transition: background-color 0.2s ease; }
        #mpf-payment-methods-list button:hover { background-color: #eee; }
        #mpf-payment-methods-list button.set-default { border-color: #007cba; color: #007cba; }
        #mpf-payment-methods-list button.delete-method { border-color: #d32f2f; color: #d32f2f; }
        #mpf-payment-methods-list p { margin-top: 10px; text-align: center; color: #666; font-size: 0.95em; }
        #mpf-add-card-heading { margin-top: 0; margin-bottom: 15px; font-size: 1.1em; color: #555; font-weight: 600; }
        #mpf-card-element label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px; }
        #mpf-card-number, #mpf-card-expiry, #mpf-card-cvc { border: 1px solid #ddd; padding: 12px; border-radius: 6px; background-color: #fff; margin-bottom: 15px; }
        .StripeElement--focus { border-color: #007cba; box-shadow: 0 0 0 2px rgba(0, 124, 186, 0.2); }
        .StripeElement--invalid { border-color: #fa755a; }
        #mpf-card-element .mpf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        #mpf-card-element .mpf-row div { margin-bottom: 0; }
        #mpf-submit-button { display: block; width: 100%; max-width: 250px; margin: 30px auto 0 auto; padding: 14px 28px; background-color: #007cba; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; text-align: center; transition: background-color 0.3s ease, box-shadow 0.3s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        #mpf-submit-button:hover:not(:disabled) { background-color: #005f8f; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15); }
        #mpf-submit-button:disabled { background-color: #ccc; cursor: not-allowed; box-shadow: none; }
        #mpf-message { margin-top: 20px; padding: 10px; font-size: 14px; text-align: center; border-radius: 4px; min-height: 1em; }
        #mpf-message.success { color: #155724; background-color: #d4edda; border: 1px solid #c3e6cb; }
        #mpf-message.error { color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; }
        #mpf-message.info { color: #004085; background-color: #cce5ff; border: 1px solid #b8daff; }
    </style>

    <div class="mpf-stripe-container">
        <div class="mpf-page-title">
            <h2>Manage Payment Methods</h2>
        </div>

        <div id="mpf-payment-methods-list">
             <h3>Your Saved Cards</h3>
             <p class="loading-msg">Loading payment methods...</p>
        </div>

         <h3 id="mpf-add-card-heading">Add New Card</h3>
        <div id="mpf-card-element">
            <label for="mpf-card-number">Card Number</label>
            <div id="mpf-card-number"></div> <div class="mpf-row">
                <div>
                    <label for="mpf-card-expiry">Expiration Date</label>
                    <div id="mpf-card-expiry"></div> </div>
                <div>
                    <label for="mpf-card-cvc">CVC</label>
                    <div id="mpf-card-cvc"></div> </div>
            </div>
        </div>

        <button id="mpf-submit-button">Save Payment Method</button>

        <div id="mpf-message" role="alert"></div>
    </div>

    <script src="https://js.stripe.com/v3/"></script>

    <script>
        document.addEventListener("DOMContentLoaded", async function () {
            // Get references to DOM elements
            const messageDiv = document.getElementById("mpf-message");
            const submitButton = document.getElementById("mpf-submit-button");
            const paymentMethodsListDiv = document.getElementById("mpf-payment-methods-list");

            // Get data passed from PHP
            const publicKey = "<?php echo $stripe_key_js; ?>";
            const orgId = "<?php echo $orgId_js; ?>";
            const apiBaseUrl = "<?php echo $api_base_url_js; ?>";
            const authToken = "<?php echo $token_js; ?>";

            // --- Helper Functions ---
            function showMessage(text, type = 'error') {
                // console.log(`[MPF DEBUG JS] showMessage called with text: "${text}", type: "${type}"`); // Debug Log
                if (!messageDiv) { console.error("[MPF DEBUG JS] messageDiv element not found!"); return; }
                messageDiv.textContent = text;
                messageDiv.className = 'mpf-message ' + type;
                if (type === 'success' || type === 'info') {
                    setTimeout(() => { if (messageDiv.textContent === text) { showMessage('', ''); } }, 5000);
                }
             }
            function setLoading(isLoading) {
                if (!submitButton) return;
                submitButton.disabled = isLoading;
                submitButton.textContent = isLoading ? 'Processing...' : 'Save Payment Method';
             }
             function getAuthHeaders() {
                 let headers = { 'Content-Type': 'application/json' };
                 if (authToken) { headers['Authorization'] = `Bearer ${authToken}`; }
                 return headers;
             }

            // --- API Call Functions ---
            async function fetchPaymentMethods() {
                if (!paymentMethodsListDiv) return; // Guard clause
                const loadingMsg = paymentMethodsListDiv.querySelector('.loading-msg');
                paymentMethodsListDiv.querySelectorAll('.payment-method-item').forEach(el => el.remove());
                paymentMethodsListDiv.querySelectorAll('.no-methods-msg').forEach(el => el.remove());
                if (loadingMsg) loadingMsg.style.display = 'block'; // Ensure loading message is visible

                try {
                    // console.log('[MPF DEBUG JS] Fetching payment methods...'); // Remove debug logs for final version
                    const response = await fetch(`${apiBaseUrl}/payment-methods/orgs/${orgId}`, { method: 'GET', headers: getAuthHeaders() });
                    // console.log('[MPF DEBUG JS] Fetch response status:', response.status); // Remove debug logs

                    if (!response.ok) {
                         let errorData = { message: `HTTP error! status: ${response.status}` };
                         try { errorData = await response.json(); } catch (e) { /* Ignore */ }
                         console.error("API Error fetching methods:", errorData);
                         throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    // console.log('[MPF DEBUG JS] API Response data:', data); // Remove debug logs
                    displayPaymentMethods(data);
                } catch (error) {
                    console.error("Error in fetchPaymentMethods:", error);
                    const loadingMsgEl = paymentMethodsListDiv.querySelector('.loading-msg');
                    if (loadingMsgEl) {
                        loadingMsgEl.textContent = `Error loading methods: ${error.message || 'Unknown error'}. Check console.`;
                        loadingMsgEl.style.color = 'red';
                    } else {
                        const errorP = document.createElement('p');
                        errorP.style.color = 'red'; errorP.textContent = `Error loading methods: ${error.message || 'Unknown error'}. Check console.`;
                         if (!paymentMethodsListDiv.querySelector('h3')) { const h3 = document.createElement('h3'); h3.textContent = 'Your Saved Cards'; paymentMethodsListDiv.prepend(h3); }
                        paymentMethodsListDiv.appendChild(errorP);
                    }
                }
            }

            function displayPaymentMethods(paymentMethods) {
                if (!paymentMethodsListDiv) return; // Guard clause
                // console.log('[MPF DEBUG JS] Displaying payment methods:', paymentMethods); // Remove debug logs
                const loadingMsgEl = paymentMethodsListDiv.querySelector('.loading-msg');
                if (loadingMsgEl) loadingMsgEl.remove();

                paymentMethodsListDiv.querySelectorAll('.payment-method-item').forEach(el => el.remove());
                paymentMethodsListDiv.querySelectorAll('.no-methods-msg').forEach(el => el.remove());

                if (!paymentMethods || paymentMethods.length === 0) {
                     // console.log('[MPF DEBUG JS] No payment methods found or array empty.'); // Remove debug logs
                     const noMethodsP = document.createElement('p');
                     noMethodsP.className = 'no-methods-msg';
                     noMethodsP.textContent = "No payment methods saved yet.";
                     paymentMethodsListDiv.appendChild(noMethodsP);
                     return;
                }

                if (!paymentMethodsListDiv.querySelector('h3')) {
                    const h3 = document.createElement('h3'); h3.textContent = 'Your Saved Cards'; paymentMethodsListDiv.prepend(h3);
                }

                paymentMethods.forEach((method) => {
                    // console.log('[MPF DEBUG JS] Processing method:', method); // Remove debug logs
                    if (!method || !method.id || !method.last4) {
                        console.warn('[MPF DEBUG JS] Skipping invalid method object (missing id or last4):', method); return;
                    }
                    const isDefault = method.isDefault;
                    const methodDiv = document.createElement("div");
                    methodDiv.className = 'payment-method-item';
                    methodDiv.innerHTML = `
                        <span>${method.brand ? method.brand.toUpperCase() : 'Card'} ending in **** ${method.last4}${isDefault ? ' <strong>(Default)</strong>' : ''}</span>
                        <span>${!isDefault ? `<button class="set-default" data-id="${method.id}" title="Set as default card">Set Default</button>` : ''}<button class="delete-method" data-id="${method.id}" title="Delete this card">Delete</button></span>`;
                    paymentMethodsListDiv.appendChild(methodDiv);
                });

                paymentMethodsListDiv.removeEventListener('click', handleListClick);
                paymentMethodsListDiv.addEventListener('click', handleListClick);
            }

            function handleListClick(event) {
                const target = event.target;
                if (target.classList.contains('set-default')) { setDefaultPaymentMethod(target.dataset.id); }
                else if (target.classList.contains('delete-method')) { if (confirm('Are you sure you want to delete this payment method?')) { deletePaymentMethod(target.dataset.id); } }
            }

            async function setDefaultPaymentMethod(paymentMethodId) {
                showMessage("Setting default...", 'info');
                try { const response = await fetch(`${apiBaseUrl}/payment-methods/orgs/${orgId}/${paymentMethodId}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ is_default: true }) }); if (response.ok) { showMessage("Default payment method updated.", 'success'); fetchPaymentMethods(); } else { const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' })); console.error("API Error setting default:", errorData); showMessage(`Failed to set default: ${errorData.message || response.statusText}`, 'error'); } } catch (error) { console.error("Network Error setting default:", error); showMessage("Error setting default payment method. Check console.", 'error'); }
            }

            async function deletePaymentMethod(paymentMethodId) {
                 showMessage("Deleting...", 'info');
                 try {
                     const response = await fetch(`${apiBaseUrl}/payment-methods/orgs/${orgId}/${paymentMethodId}`, { method: "DELETE", headers: getAuthHeaders() });
                     if (response.ok) {
                         // console.log('[MPF DEBUG JS] Delete successful (response.ok)'); // Remove debug logs
                         showMessage("Payment method deleted.", 'success');
                         fetchPaymentMethods();
                     } else {
                         const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
                         console.error("API Error deleting:", errorData);
                         const errorMsg = `Failed to delete: ${errorData.message || response.statusText}`;
                         // console.log('[MPF DEBUG JS] Attempting to show error message:', errorMsg); // Remove debug logs
                         showMessage(errorMsg, 'error');
                         // console.log('[MPF DEBUG JS] Finished calling showMessage for error.'); // Remove debug logs
                     }
                 } catch (error) {
                     console.error("Network Error deleting:", error);
                     const errorMsg = `Error deleting payment method: ${error.message || 'Unknown network error'}. Check console.`;
                     // console.log('[MPF DEBUG JS] Attempting to show network error message:', errorMsg); // Remove debug logs
                     showMessage(errorMsg, 'error');
                     // console.log('[MPF DEBUG JS] Finished calling showMessage for network error.'); // Remove debug logs
                 }
             }

            // --- Stripe Initialization ---
            let stripe, elements, cardNumber, cardExpiry, cardCvc;
            try {
                if (!publicKey) { throw new Error("Stripe public key is missing."); }
                stripe = Stripe(publicKey);
                elements = stripe.elements();
                const elementStyles = { base: { color: "#32325d", fontFamily: '"Helvetica Neue", Helvetica, sans-serif', fontSmoothing: "antialiased", fontSize: "16px", "::placeholder": { color: "#aab7c4", }, }, invalid: { color: "#fa755a", iconColor: "#fa755a", }, };
                cardNumber = elements.create('cardNumber', { style: elementStyles }); cardNumber.mount('#mpf-card-number');
                cardExpiry = elements.create('cardExpiry', { style: elementStyles }); cardExpiry.mount('#mpf-card-expiry');
                cardCvc = elements.create('cardCvc', { style: elementStyles }); cardCvc.mount('#mpf-card-cvc');
                function handleElementChange(event) { if (event.error) { showMessage(event.error.message, 'error'); } else { showMessage('', ''); } }
                cardNumber.on('change', handleElementChange); cardExpiry.on('change', handleElementChange); cardCvc.on('change', handleElementChange);

                // --- Form Submission Logic ---
                if (submitButton) {
                    submitButton.addEventListener("click", async (event) => {
                        event.preventDefault(); setLoading(true); showMessage('');
                        if (!stripe || !cardNumber) { showMessage('Stripe components not ready.', 'error'); setLoading(false); return; }
                        try {
                            const { paymentMethod, error } = await stripe.createPaymentMethod({ type: 'card', card: cardNumber });
                            if (error) { console.error("Stripe Error:", error); showMessage(error.message || "Error creating payment method.", 'error'); setLoading(false); return; }
                            const response = await fetch(`${apiBaseUrl}/payment-methods/orgs/${orgId}`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ paymentMethodId: paymentMethod.id }) });
                            if (response.ok) { showMessage("Payment method added!", 'success'); fetchPaymentMethods(); cardNumber.clear(); cardExpiry.clear(); cardCvc.clear(); }
                            else { const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' })); console.error("API Error saving:", errorData); showMessage(`Failed to save method: ${errorData.message || response.statusText}`, 'error'); }
                        } catch (networkError) { console.error("Network error:", networkError); showMessage("An error occurred. Please try again.", 'error'); }
                        finally { setLoading(false); }
                    });
                } else {
                     console.warn('[MPF Stripe Plugin] Submit button not found.');
                }
            } catch (stripeError) { console.error("Stripe Init Error:", stripeError); showMessage(`Stripe Error: ${stripeError.message}.`, 'error'); if (submitButton) submitButton.disabled = true; }

            // --- Initial Load ---
            fetchPaymentMethods(); // Load methods when page loads
        }); // End DOMContentLoaded
    </script>
    <?php
    // Get the buffered content and return it
    return ob_get_clean();
}

// Register the shortcode
add_shortcode('myphonefriend_payment_form', 'mpf_stripe_payment_form_shortcode_handler');

// Remove the filter that was previously used
// (Ensure no leftover filter function exists or is added)
// remove_filter('the_content', 'your_previous_filter_function_name'); // If you had named it

?>
