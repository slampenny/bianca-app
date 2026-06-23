<?php
/**
 * Book a Demo page (Contact Form 7) + CF7 shortcode helpers.
 *
 * @package Bianca_Wellness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Contact Form 7 post ID (production default: 320).
 */
function bianca_wellness_contact_cf7_form_id() {
	$stored = (int) get_option( 'bianca_wellness_contact_cf7_id', 0 );
	if ( $stored > 0 ) {
		return $stored;
	}

	if ( post_type_exists( 'wpcf7_contact_form' ) ) {
		$by_title = get_posts(
			array(
				'post_type'      => 'wpcf7_contact_form',
				'posts_per_page' => 1,
				'title'          => 'Contact form 1',
				'post_status'    => 'publish',
				'fields'         => 'ids',
			)
		);
		if ( ! empty( $by_title ) ) {
			return (int) $by_title[0];
		}

		$latest = get_posts(
			array(
				'post_type'      => 'wpcf7_contact_form',
				'posts_per_page' => 1,
				'orderby'        => 'ID',
				'order'          => 'ASC',
				'post_status'    => 'publish',
				'fields'         => 'ids',
			)
		);
		if ( ! empty( $latest ) ) {
			return (int) $latest[0];
		}
	}

	return 320;
}

/**
 * Replace curly quotes around CF7 shortcode attributes.
 *
 * @param string $text HTML or block markup.
 */
function bianca_wellness_normalize_cf7_shortcode_quotes( $text ) {
	if ( strpos( $text, 'contact-form-7' ) === false ) {
		return $text;
	}

	return preg_replace_callback(
		'/(\[contact-form-7[^\]]*\])/iu',
		function ( $match ) {
			$shortcode = $match[1];
			$shortcode = str_replace(
				array( "\x{201C}", "\x{201D}", "\x{2018}", "\x{2019}" ),
				array( '"', '"', "'", "'" ),
				$shortcode
			);
			return $shortcode;
		},
		$text
	);
}

/**
 * Run CF7 shortcodes left as plain text in page content.
 *
 * @param string $content Post content HTML.
 */
function bianca_wellness_process_cf7_shortcodes_in_content( $content ) {
	if ( strpos( $content, 'contact-form-7' ) === false ) {
		return $content;
	}

	$content = bianca_wellness_normalize_cf7_shortcode_quotes( $content );

	if ( preg_match( '/\[contact-form-7[^\]]*\]/i', $content ) ) {
		$content = do_shortcode( $content );
	}

	return $content;
}
add_filter( 'the_content', 'bianca_wellness_normalize_cf7_shortcode_quotes', 9 );
add_filter( 'the_content', 'bianca_wellness_process_cf7_shortcodes_in_content', 12 );

/**
 * Block markup for the Book a Demo page.
 *
 * @return string
 */
function bianca_wellness_book_demo_page_block_markup() {
	$data_file = get_template_directory() . '/data/book-a-demo-page-blocks.html';
	if ( is_readable( $data_file ) ) {
		$content = file_get_contents( $data_file );
		if ( is_string( $content ) && $content !== '' ) {
			return str_replace(
				'CONTACT_FORM_ID',
				(string) bianca_wellness_contact_cf7_form_id(),
				$content
			);
		}
	}

	$form_id = bianca_wellness_contact_cf7_form_id();

	return '<!-- wp:group {"className":"bianca-container bianca-prose bianca-contact bianca-book-demo"} -->
<div class="wp-block-group bianca-container bianca-prose bianca-contact bianca-book-demo"><!-- wp:heading -->
<h2 class="wp-block-heading">Book a Demo</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>See what Bianca detects in a 30-minute walkthrough. Tell us a bit about your organization and we\'ll be in touch to schedule a demo.</p>
<!-- /wp:paragraph -->

<!-- wp:shortcode -->
[contact-form-7 id="' . $form_id . '" html_class="bianca-contact-wpcf7"]
<!-- /wp:shortcode --></div>
<!-- /wp:group -->';
}

/**
 * Public URL for the Book a Demo form page.
 */
function bianca_wellness_book_demo_page_url() {
	return home_url( '/book-a-demo/' );
}

/**
 * Alias used by Try the App off-hours routing and nav filters.
 */
function bianca_wellness_book_demo_url() {
	return bianca_wellness_book_demo_page_url();
}

/**
 * Create or refresh /book-a-demo/ when missing or markup is outdated.
 */
function bianca_wellness_seed_book_demo_page() {
	$markup = bianca_wellness_book_demo_page_block_markup();
	$hash   = md5( $markup );

	$posts = get_posts(
		array(
			'name'           => 'book-a-demo',
			'post_type'      => 'page',
			'post_status'    => 'any',
			'posts_per_page' => 1,
		)
	);

	if ( empty( $posts ) ) {
		$page_id = wp_insert_post(
			array(
				'post_title'   => __( 'Book a Demo', 'bianca-wellness' ),
				'post_name'    => 'book-a-demo',
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_content' => $markup,
			),
			true
		);
		if ( ! is_wp_error( $page_id ) && $page_id ) {
			update_option( 'bianca_wellness_book_demo_page_hash', $hash );
		}
		return;
	}

	$stored = get_option( 'bianca_wellness_book_demo_page_hash', '' );
	if ( $stored === $hash ) {
		return;
	}

	wp_update_post(
		array(
			'ID'           => (int) $posts[0]->ID,
			'post_title'   => __( 'Book a Demo', 'bianca-wellness' ),
			'post_content' => $markup,
			'post_status'  => 'publish',
		)
	);
	update_option( 'bianca_wellness_book_demo_page_hash', $hash );
}
add_action( 'init', 'bianca_wellness_seed_book_demo_page', 22 );
