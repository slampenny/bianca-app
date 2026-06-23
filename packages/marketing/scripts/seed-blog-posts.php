<?php
/**
 * One-time import: create scheduled WordPress posts in the database from blog-posts-seed.json.
 *
 * After seeding, posts live in wp_posts like any other WordPress content — edit and schedule
 * in wp-admin. Re-run is idempotent (skips existing slugs).
 *
 * Usage (on server):
 *   UNSPLASH_ACCESS_KEY=... wp eval-file seed-blog-posts.php --path=/opt/bitnami/wordpress --allow-root
 *
 * @package Bianca_Wellness
 */

if ( ! defined( 'ABSPATH' ) ) {
	$wp_load = '/opt/bitnami/wordpress/wp-load.php';
	if ( is_readable( $wp_load ) ) {
		require_once $wp_load;
	} else {
		require_once dirname( __DIR__, 4 ) . '/wp-load.php';
	}
}

require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

/**
 * @return string
 */
function bianca_blog_unsplash_access_key() {
	$key = getenv( 'UNSPLASH_ACCESS_KEY' );
	if ( is_string( $key ) && $key !== '' ) {
		return trim( $key );
	}

	$env_file = getenv( 'BIANCA_UNSPLASH_ENV' );
	if ( ! is_string( $env_file ) || $env_file === '' ) {
		$env_file = '';
	}

	if ( is_readable( $env_file ) ) {
		foreach ( file( $env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES ) as $line ) {
			if ( str_starts_with( trim( $line ), 'UNSPLASH_ACCESS_KEY=' ) ) {
				return trim( substr( trim( $line ), strlen( 'UNSPLASH_ACCESS_KEY=' ) ), " \t\"'" );
			}
		}
	}

	return '';
}

/**
 * @param string $query Search query.
 * @param string $access_key Unsplash access key.
 * @return array{url: string, download: string, photographer: string}|null
 */
function bianca_blog_fetch_unsplash_photo( $query, $access_key ) {
	if ( $access_key === '' ) {
		echo "⚠️  No UNSPLASH_ACCESS_KEY — skipping image for query: {$query}\n";
		return null;
	}

	$url = 'https://api.unsplash.com/search/photos?' . http_build_query(
		array(
			'query'    => $query,
			'per_page' => 1,
			'orientation' => 'landscape',
		)
	);

	$response = wp_remote_get(
		$url,
		array(
			'headers' => array(
				'Authorization' => 'Client-ID ' . $access_key,
				'Accept-Version' => 'v1',
			),
			'timeout' => 30,
		)
	);

	if ( is_wp_error( $response ) ) {
		echo '⚠️  Unsplash request failed: ' . $response->get_error_message() . "\n";
		return null;
	}

	$code = (int) wp_remote_retrieve_response_code( $response );
	$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

	if ( $code !== 200 || ! is_array( $body ) || empty( $body['results'][0] ) ) {
		echo "⚠️  Unsplash returned no results for: {$query}\n";
		return null;
	}

	$photo = $body['results'][0];

	return array(
		'url'          => (string) ( $photo['urls']['regular'] ?? '' ),
		'download'     => (string) ( $photo['links']['download_location'] ?? '' ),
		'photographer' => (string) ( $photo['user']['name'] ?? 'Unsplash' ),
	);
}

/**
 * @param string $download_location Unsplash download trigger URL.
 * @param string $access_key Unsplash access key.
 */
function bianca_blog_trigger_unsplash_download( $download_location, $access_key ) {
	if ( $download_location === '' || $access_key === '' ) {
		return;
	}

	wp_remote_get(
		$download_location,
		array(
			'headers' => array(
				'Authorization' => 'Client-ID ' . $access_key,
				'Accept-Version' => 'v1',
			),
			'timeout' => 15,
		)
	);
}

/**
 * @param string $image_url Remote image URL.
 * @param int    $post_id Post ID.
 * @param string $title Attachment title.
 * @return int Attachment ID or 0.
 */
function bianca_blog_sideload_featured_image( $image_url, $post_id, $title ) {
	$tmp = download_url( $image_url, 30 );
	if ( is_wp_error( $tmp ) ) {
		echo '⚠️  Image download failed: ' . $tmp->get_error_message() . "\n";
		return 0;
	}

	$file_array = array(
		'name'     => sanitize_file_name( $title ) . '.jpg',
		'tmp_name' => $tmp,
	);

	$attachment_id = media_handle_sideload( $file_array, $post_id, $title );
	if ( is_wp_error( $attachment_id ) ) {
		@unlink( $tmp );
		echo '⚠️  Media sideload failed: ' . $attachment_id->get_error_message() . "\n";
		return 0;
	}

	set_post_thumbnail( $post_id, $attachment_id );

	return (int) $attachment_id;
}

if ( defined( 'BIANCA_BLOG_LIBRARY' ) ) {
	return;
}

$seed_file = dirname( __FILE__ ) . '/blog-posts-seed.json';

if ( ! is_readable( $seed_file ) ) {
	echo "❌ Seed data not found: {$seed_file}\n";
	exit( 1 );
}

$manifest = json_decode( (string) file_get_contents( $seed_file ), true );
if ( ! is_array( $manifest ) || empty( $manifest ) ) {
	echo "❌ Invalid blog-posts-seed.json\n";
	exit( 1 );
}

$access_key = bianca_blog_unsplash_access_key();
$created    = 0;
$skipped    = 0;

foreach ( $manifest as $entry ) {
	$title   = (string) ( $entry['title'] ?? '' );
	$slug    = (string) ( $entry['slug'] ?? '' );
	$excerpt = (string) ( $entry['excerpt'] ?? '' );
	$query   = (string) ( $entry['image_query'] ?? 'senior care' );
	$date    = (string) ( $entry['publish_date'] ?? '' );
	$content = (string) ( $entry['content'] ?? '' );

	if ( $title === '' || $slug === '' || $content === '' || $date === '' ) {
		echo "⚠️  Skipping incomplete seed entry\n";
		continue;
	}

	$existing = get_posts(
		array(
			'name'           => $slug,
			'post_type'      => 'post',
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'fields'         => 'ids',
		)
	);

	if ( ! empty( $existing ) ) {
		echo "↷ Exists: {$slug}\n";
		++$skipped;
		continue;
	}

	$status = ( strtotime( $date ) > current_time( 'timestamp' ) ) ? 'future' : 'publish';

	$post_id = wp_insert_post(
		array(
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_excerpt' => $excerpt,
			'post_content' => $content,
			'post_status'  => $status,
			'post_type'    => 'post',
			'post_date'    => $date,
			'post_date_gmt' => get_gmt_from_date( $date ),
		),
		true
	);

	if ( is_wp_error( $post_id ) || ! $post_id ) {
		$msg = is_wp_error( $post_id ) ? $post_id->get_error_message() : 'unknown error';
		echo "❌ Failed {$slug}: {$msg}\n";
		continue;
	}

	update_post_meta( (int) $post_id, '_bianca_image_query', $query );

	$photo = bianca_blog_fetch_unsplash_photo( $query, $access_key );
	if ( is_array( $photo ) && $photo['url'] !== '' ) {
		bianca_blog_trigger_unsplash_download( $photo['download'], $access_key );
		$attachment_id = bianca_blog_sideload_featured_image( $photo['url'], (int) $post_id, $title );
		if ( $attachment_id ) {
			update_post_meta( $attachment_id, '_unsplash_photographer', $photo['photographer'] );
		}
	}

	echo "✅ Scheduled ({$status}): {$slug} → {$date}\n";
	++$created;

	// Respect Unsplash rate limits.
	sleep( 1 );
}

echo "\nDone. Created: {$created}, skipped: {$skipped}\n";
