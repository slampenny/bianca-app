<?php
/**
 * Page title rendering — avoid duplicating headings already in block content.
 *
 * @package Bianca_Wellness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Whether page body content already includes a primary heading.
 *
 * @param WP_Post|int|null $post Post object or ID.
 */
function bianca_wellness_page_has_content_heading( $post = null ) {
	$post = get_post( $post );
	if ( ! $post || $post->post_type !== 'page' ) {
		return false;
	}

	$content = (string) $post->post_content;
	if ( $content === '' ) {
		return false;
	}

	if ( preg_match( '/<!--\s*wp:heading\b/i', $content ) ) {
		return true;
	}

	if ( preg_match( '/<h[12][\s>]/i', $content ) ) {
		return true;
	}

	return false;
}

/**
 * Whether page.php should output the WordPress page title as h1.
 *
 * @param WP_Post|int|null $post Post object or ID.
 */
function bianca_wellness_should_render_page_title( $post = null ) {
	return ! bianca_wellness_page_has_content_heading( $post );
}
