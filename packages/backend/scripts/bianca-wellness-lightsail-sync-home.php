<?php
/**
 * Run on Lightsail via: wp eval-file .../bianca-wellness-lightsail-sync-home.php
 * WordPress is already loaded. Active theme must be bianca-wellness.
 *
 * @package Bianca_Wellness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

$data_file = get_template_directory() . '/data/home-page-blocks.html';
if ( ! is_readable( $data_file ) ) {
	fwrite( STDERR, "bianca-wellness: missing or unreadable {$data_file}\n" );
	exit( 1 );
}

$content = file_get_contents( $data_file );
if ( ! is_string( $content ) || $content === '' ) {
	fwrite( STDERR, "bianca-wellness: empty home-page-blocks.html\n" );
	exit( 1 );
}

$pages = get_posts(
	array(
		'name'           => 'home',
		'post_type'      => 'page',
		'post_status'    => 'any',
		'posts_per_page' => 1,
	)
);

if ( ! empty( $pages ) ) {
	$id = (int) $pages[0]->ID;
	wp_update_post(
		array(
			'ID'           => $id,
			'post_content' => $content,
			'post_status'  => 'publish',
		)
	);
} else {
	$id = (int) wp_insert_post(
		array(
			'post_title'   => 'Home',
			'post_name'    => 'home',
			'post_status'  => 'publish',
			'post_type'    => 'page',
			'post_content' => $content,
		),
		true
	);
	if ( ! $id ) {
		fwrite( STDERR, "bianca-wellness: could not create Home page\n" );
		exit( 1 );
	}
}

update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $id );
update_option( 'bianca_wellness_landing_seeded', 1 );

echo "bianca-wellness: front page synced, ID={$id}\n";
