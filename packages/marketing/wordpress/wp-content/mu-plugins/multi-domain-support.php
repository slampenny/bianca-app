<?php
/**
 * Plugin Name: Multi-Domain Support
 * Description: Allows WordPress to work with biancawellness.com and biancatechnologies.com (and local / IP smoke tests).
 * Version: 1.1
 * Author: MyPhoneFriend Team
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/** Hosts that may serve this site (no redirects between these). Dead domains removed. */
function bianca_multi_domain_allowed_list() {
    return array(
        'biancawellness.com',
        'www.biancawellness.com',
        'biancatechnologies.com',
        'www.biancatechnologies.com',
        'localhost',
        '127.0.0.1',
    );
}

function bianca_multi_domain_is_localhostish($host) {
    return strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false;
}

function bianca_multi_domain_current_host() {
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    return preg_replace('/:\d+$/', '', $host);
}

function bianca_multi_domain_is_allowed($current_domain) {
    if ($current_domain === '') {
        return true;
    }
    if (in_array($current_domain, bianca_multi_domain_allowed_list(), true)) {
        return true;
    }
    if (bianca_multi_domain_is_localhostish($current_domain)) {
        return true;
    }
    // Lightsail / EC2 smoke test by IP or hostname until DNS is cut over.
    return (bool) filter_var($current_domain, FILTER_VALIDATE_IP);
}

/**
 * Unknown Host → primary marketing host (never a retired domain).
 */
function myphonefriend_allow_multiple_domains() {
    $current_domain = bianca_multi_domain_current_host();

    if (bianca_multi_domain_is_allowed($current_domain)) {
        return;
    }

    if ($current_domain === '') {
        return;
    }

    $primary_domain = 'biancawellness.com';
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $redirect_url = $protocol . '://' . $primary_domain . ($_SERVER['REQUEST_URI'] ?? '/');
    wp_redirect($redirect_url, 301);
    exit;
}
add_action('init', 'myphonefriend_allow_multiple_domains', 1);

function myphonefriend_filter_site_url($url, $path, $scheme, $blog_id) {
    $current_domain = bianca_multi_domain_current_host();

    if (!bianca_multi_domain_is_allowed($current_domain)) {
        return $url;
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $parsed = parse_url($url);
    if ($parsed) {
        $url = $protocol . '://' . $current_domain;
        if (isset($parsed['path'])) {
            $url .= $parsed['path'];
        }
        if (isset($parsed['query'])) {
            $url .= '?' . $parsed['query'];
        }
        if (isset($parsed['fragment'])) {
            $url .= '#' . $parsed['fragment'];
        }
    }

    return $url;
}
add_filter('site_url', 'myphonefriend_filter_site_url', 10, 4);
add_filter('home_url', 'myphonefriend_filter_site_url', 10, 4);

function myphonefriend_filter_content_url($url) {
    $current_domain = bianca_multi_domain_current_host();

    if (!bianca_multi_domain_is_allowed($current_domain)) {
        return $url;
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $allowed = array_merge(bianca_multi_domain_allowed_list(), array('myphonefriend.com'));
    $domain_pattern = '(' . implode('|', array_map('preg_quote', $allowed)) . ')';
    $url = preg_replace('#https?://(www\.)?' . $domain_pattern . '#', $protocol . '://' . $current_domain, $url);

    return $url;
}
add_filter('content_url', 'myphonefriend_filter_content_url');
add_filter('plugins_url', 'myphonefriend_filter_content_url');
add_filter('the_content', 'myphonefriend_filter_content_url');
add_filter('widget_text', 'myphonefriend_filter_content_url');

function myphonefriend_prevent_canonical_redirect($redirect_url, $requested_url) {
    if (bianca_multi_domain_is_allowed(bianca_multi_domain_current_host())) {
        return false;
    }
    return $redirect_url;
}
add_filter('redirect_canonical', 'myphonefriend_prevent_canonical_redirect', 10, 2);
