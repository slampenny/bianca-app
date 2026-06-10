<?php
/**
 * One-time: create /try-the-app/ page and point nav "Try the App" links at it.
 * Run on Lightsail/EC2: php setup-try-the-app-page.php
 */
require_once '/var/www/html/wp-load.php';

if ( ! function_exists( 'bianca_wellness_seed_try_app_page' ) ) {
	echo "❌ Activate the bianca-wellness theme first.\n";
	exit( 1 );
}

delete_option( 'bianca_wellness_try_app_seeded' );
bianca_wellness_seed_try_app_page();

$try_app_url = home_url( '/try-the-app/' );
$menus       = wp_get_nav_menus();
$updated     = 0;

foreach ( $menus as $menu ) {
	$items = wp_get_nav_menu_items( $menu->term_id );
	if ( ! $items ) {
		continue;
	}
	foreach ( $items as $item ) {
		if ( $item->title !== 'Try the App' ) {
			continue;
		}
		if (
			strpos( $item->url, 'myphonefriend.com' ) !== false
			|| strpos( $item->url, 'app.biancawellness.com' ) !== false
		) {
			wp_update_nav_menu_item(
				$menu->term_id,
				$item->ID,
				array(
					'menu-item-title'     => 'Try the App',
					'menu-item-url'       => $try_app_url,
					'menu-item-status'    => 'publish',
					'menu-item-type'      => 'custom',
					'menu-item-parent-id' => $item->menu_item_parent,
				)
			);
			++$updated;
		}
	}
}

echo "✅ Try the App page: {$try_app_url}\n";
echo "✅ Updated {$updated} menu item(s) to /try-the-app/\n";
