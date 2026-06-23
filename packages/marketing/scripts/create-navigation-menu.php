<?php
require_once '/var/www/html/wp-load.php';

// Create menu if it doesn't exist
$menu_name = 'Main Navigation';
$menu = wp_get_nav_menu_object($menu_name);

if (!$menu) {
    $menu_id = wp_create_nav_menu($menu_name);
    echo "Created menu: $menu_name (ID: $menu_id)\n";
} else {
    $menu_id = $menu->term_id;
    echo "Menu exists: $menu_name (ID: $menu_id)\n";
}

// Clear existing menu items
$items = wp_get_nav_menu_items($menu_id);
if ($items) {
    foreach ($items as $item) {
        wp_delete_post($item->ID, true);
    }
}

// Add menu items
$menu_items = array(
    array('title' => 'Solutions', 'url' => '#', 'parent' => 0),
    array('title' => 'For Administrators', 'url' => '/administrators-solutions', 'parent' => 'Solutions'),
    array('title' => 'For Caregivers', 'url' => '/caregivers', 'parent' => 'Solutions'),
    array('title' => 'For Seniors', 'url' => '/seniors', 'parent' => 'Solutions'),
    array('title' => 'Company', 'url' => '#', 'parent' => 0),
    array('title' => 'About Us', 'url' => '/about', 'parent' => 'Company'),
    array('title' => 'Press & Media', 'url' => '/press', 'parent' => 'Company'),
    array('title' => 'Careers', 'url' => '/careers', 'parent' => 'Company'),
    array('title' => 'Contact', 'url' => '/contact', 'parent' => 'Company'),
    array('title' => 'Resources', 'url' => '#', 'parent' => 0),
    array('title' => 'Blog', 'url' => '/blog', 'parent' => 'Resources'),
    array('title' => 'Support', 'url' => '/support', 'parent' => 'Resources'),
    array('title' => 'Privacy Policy', 'url' => '/privacy', 'parent' => 'Resources'),
    array('title' => 'Terms of Service', 'url' => '/terms', 'parent' => 'Resources'),
    array('title' => 'HIPAA Privacy Practices', 'url' => '/privacy-practices', 'parent' => 'Resources'),
    array('title' => 'Try the App', 'url' => '/try-the-app/', 'parent' => 0),
);

$parent_ids = array();
foreach ($menu_items as $item) {
    $parent_id = 0;
    if ($item['parent'] && isset($parent_ids[$item['parent']])) {
        $parent_id = $parent_ids[$item['parent']];
    }
    
    $item_id = wp_update_nav_menu_item($menu_id, 0, array(
        'menu-item-title' => $item['title'],
        'menu-item-url' => $item['url'],
        'menu-item-status' => 'publish',
        'menu-item-type' => 'custom',
        'menu-item-parent-id' => $parent_id,
    ));
    
    if ($item['parent'] == 0) {
        $parent_ids[$item['title']] = $item_id;
    }
    
    echo "Added: {$item['title']}\n";
}

$locations = get_theme_mod( 'nav_menu_locations', array() );
$locations['primary'] = (int) $menu_id;
set_theme_mod( 'nav_menu_locations', $locations );
echo "Assigned menu to primary theme location\n";

echo "Menu created successfully\n";

