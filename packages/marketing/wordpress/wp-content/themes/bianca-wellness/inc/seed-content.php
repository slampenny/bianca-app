<?php
/**
 * One-time seed: creates Home page with block markup from data file + assigns as front page.
 *
 * @package Bianca_Wellness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Run after theme switch (admin).
 */
function bianca_wellness_seed_landing_page() {
	if ( get_option( 'bianca_wellness_landing_seeded' ) ) {
		return;
	}

	$data_file = get_template_directory() . '/data/home-page-blocks.html';
	if ( ! is_readable( $data_file ) ) {
		return;
	}

	$content = file_get_contents( $data_file );
	if ( ! is_string( $content ) || $content === '' ) {
		return;
	}

	$existing = get_posts(
		array(
			'name'           => 'home',
			'post_type'      => 'page',
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'fields'         => 'ids',
		)
	);
	if ( ! empty( $existing ) ) {
		update_option( 'bianca_wellness_landing_seeded', 1 );
		return;
	}

	$page_id = wp_insert_post(
		array(
			'post_title'   => __( 'Home', 'bianca-wellness' ),
			'post_name'    => 'home',
			'post_status'  => 'publish',
			'post_type'    => 'page',
			'post_content' => $content,
		),
		true
	);

	if ( is_wp_error( $page_id ) || ! $page_id ) {
		return;
	}

	update_option( 'show_on_front', 'page' );
	update_option( 'page_on_front', (int) $page_id );
	update_option( 'bianca_wellness_landing_seeded', 1 );
}
add_action( 'after_switch_theme', 'bianca_wellness_seed_landing_page' );

