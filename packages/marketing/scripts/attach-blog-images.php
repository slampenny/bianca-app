<?php
/**
 * Attach Unsplash featured images to seeded posts missing thumbnails.
 * Reads posts from the WordPress database (not repo content files).
 *
 * Usage:
 *   UNSPLASH_ACCESS_KEY=... wp eval-file attach-blog-images.php --path=/opt/bitnami/wordpress --allow-root
 */

if ( ! defined( 'ABSPATH' ) ) {
	require_once '/opt/bitnami/wordpress/wp-load.php';
}

require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

define( 'BIANCA_BLOG_LIBRARY', true );
require dirname( __FILE__ ) . '/seed-blog-posts.php';

$access_key = bianca_blog_unsplash_access_key();
$attached   = 0;
$skipped    = 0;

$post_ids = get_posts(
	array(
		'post_type'      => 'post',
		'post_status'    => array( 'future', 'publish', 'draft' ),
		'posts_per_page' => -1,
		'fields'         => 'ids',
		'meta_key'       => '_bianca_image_query',
	)
);

foreach ( $post_ids as $post_id ) {
	$post_id = (int) $post_id;
	$post    = get_post( $post_id );
	if ( ! $post ) {
		continue;
	}

	$slug  = (string) $post->post_name;
	$title = (string) $post->post_title;
	$query = (string) get_post_meta( $post_id, '_bianca_image_query', true );
	if ( $query === '' ) {
		$query = 'senior care';
	}

	if ( has_post_thumbnail( $post_id ) ) {
		echo "↷ Has image: {$slug}\n";
		++$skipped;
		continue;
	}

	$photo = bianca_blog_fetch_unsplash_photo( $query, $access_key );
	if ( ! is_array( $photo ) || $photo['url'] === '' ) {
		$photo = bianca_blog_fetch_unsplash_photo( 'senior care elderly', $access_key );
	}

	if ( ! is_array( $photo ) || $photo['url'] === '' ) {
		echo "❌ No image for: {$slug}\n";
		continue;
	}

	bianca_blog_trigger_unsplash_download( $photo['download'], $access_key );
	$attachment_id = bianca_blog_sideload_featured_image( $photo['url'], $post_id, $title );
	if ( $attachment_id ) {
		update_post_meta( $attachment_id, '_unsplash_photographer', $photo['photographer'] );
		echo "✅ Image attached: {$slug}\n";
		++$attached;
	}

	sleep( 1 );
}

echo "\nAttached: {$attached}, skipped: {$skipped}\n";
