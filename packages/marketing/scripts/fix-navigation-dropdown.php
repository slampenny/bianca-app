<?php
require_once '/var/www/html/wp-load.php';

// Delete and recreate the menu to fix dropdown issues
$menu_name = 'Main Navigation';
$menu = wp_get_nav_menu_object($menu_name);

if ($menu) {
    // Delete all menu items
    $items = wp_get_nav_menu_items($menu->term_id);
    if ($items) {
        foreach ($items as $item) {
            wp_delete_post($item->ID, true);
        }
    }
    
    // Recreate menu items with proper hierarchy
    $solutions_id = wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Solutions',
        'menu-item-url' => '#',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'For Administrators',
        'menu-item-url' => '/administrators-solutions',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $solutions_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'For Caregivers',
        'menu-item-url' => '/caregivers',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $solutions_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'For Seniors',
        'menu-item-url' => '/seniors',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $solutions_id,
    ));
    
    $company_id = wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Company',
        'menu-item-url' => '#',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'About Us',
        'menu-item-url' => '/about',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $company_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Press & Media',
        'menu-item-url' => '/press',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $company_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Careers',
        'menu-item-url' => '/careers',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $company_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Contact',
        'menu-item-url' => '/contact',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $company_id,
    ));
    
    $resources_id = wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Resources',
        'menu-item-url' => '#',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Blog',
        'menu-item-url' => '/blog',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $resources_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Support',
        'menu-item-url' => '/support',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $resources_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Privacy Policy',
        'menu-item-url' => '/privacy',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $resources_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Terms of Service',
        'menu-item-url' => '/terms',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $resources_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'HIPAA Privacy Practices',
        'menu-item-url' => '/privacy-practices',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $resources_id,
    ));
    
    wp_update_nav_menu_item($menu->term_id, 0, array(
        'menu-item-title' => 'Try the App',
        'menu-item-url' => '/try-the-app/',
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
    ));
    
    $locations = get_theme_mod('nav_menu_locations', array());
    $locations['primary'] = (int) $menu->term_id;
    set_theme_mod('nav_menu_locations', $locations);
    
    echo "✅ Menu recreated with proper hierarchy\n";
} else {
    echo "❌ Menu not found\n";
}

