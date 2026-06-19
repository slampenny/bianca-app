<?php
/**
 * Plugin Name: Bianca Page Redirects
 * Description: Redirects old URLs to new ones
 * Version: 1.0
 */

add_action('template_redirect', 'bianca_page_redirects');

function bianca_page_redirects() {
    $request_uri = $_SERVER['REQUEST_URI'];
    
    // Remove query string for comparison
    $path = parse_url($request_uri, PHP_URL_PATH);
    
    // Redirect /administrators to /administrators-solutions
    if ($path === '/administrators' || $path === '/administrators/') {
        wp_redirect('/administrators-solutions', 301);
        exit;
    }
    
    // Redirect /news to /blog
    if ($path === '/news' || $path === '/news/') {
        wp_redirect('/blog', 301);
        exit;
    }
}

