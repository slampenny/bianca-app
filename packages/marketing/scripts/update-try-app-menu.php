<?php
require_once '/var/www/html/wp-load.php';

$menu_name = 'Main Navigation';
$menu = wp_get_nav_menu_object($menu_name);
$try_app_url = home_url( '/try-the-app/' );

if ( $menu ) {
	$items = wp_get_nav_menu_items( $menu->term_id );
	foreach ( $items as $item ) {
		if ( $item->title !== 'Try the App' ) {
			continue;
		}
		if (
			strpos( $item->url, 'myphonefriend.com' ) !== false
			|| strpos( $item->url, 'app.biancawellness.com' ) !== false
			|| $item->url === $try_app_url
		) {
			wp_update_nav_menu_item(
				$menu->term_id,
				$item->ID,
				array(
					'menu-item-title'       => 'Try the App',
					'menu-item-url'         => $try_app_url,
					'menu-item-status'      => 'publish',
					'menu-item-type'        => 'custom',
					'menu-item-parent-id'   => $item->menu_item_parent,
				)
			);
			echo "✅ Updated 'Try the App' menu item to {$try_app_url}\n";
			break;
		}
	}
} else {
	echo "❌ Menu not found\n";
}
