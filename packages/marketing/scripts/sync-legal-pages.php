<?php
/**
 * Force-sync legal pages from theme data/legal/*.md
 * Run: wp eval-file sync-legal-pages.php --allow-root
 */
if ( ! function_exists( 'bianca_wellness_sync_legal_pages_from_theme_files' ) ) {
	fwrite( STDERR, "bianca-wellness theme not active or legal-content.php missing.\n" );
	exit( 1 );
}

global $wpdb;
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'bianca_legal_hash_%'" );

bianca_wellness_sync_legal_pages_from_theme_files();

foreach ( bianca_wellness_legal_page_definitions() as $def ) {
	$posts = get_posts(
		array(
			'name'           => $def['slug'],
			'post_type'      => 'page',
			'post_status'    => 'publish',
			'posts_per_page' => 1,
		)
	);
	if ( empty( $posts ) ) {
		echo "MISSING: {$def['slug']}\n";
	} else {
		echo "OK: /{$def['slug']}/ (ID {$posts[0]->ID})\n";
	}
}
