<?php
/**
 * Bianca Wellness theme — content is edited in Pages (block editor).
 *
 * @package Bianca_Wellness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BIANCA_WELLNESS_VERSION', '1.0.8' );

/** Canonical product URLs (match bianca-app Route53 / ALB). */
define( 'BIANCA_WELLNESS_APP_URL', 'https://app.biancawellness.com' );
define( 'BIANCA_WELLNESS_DEMO_URL', 'https://demo.biancawellness.com' );

/**
 * App URL with optional path (e.g. signup?plan=basic).
 *
 * @param string $path Optional path/query after the app host.
 */
function bianca_wellness_app_url( $path = '' ) {
	$base = trailingslashit( BIANCA_WELLNESS_APP_URL );
	return $path ? $base . ltrim( $path, '/' ) : untrailingslashit( BIANCA_WELLNESS_APP_URL );
}

/**
 * On-site gate page before sending visitors to production app.
 */
function bianca_wellness_try_app_page_url() {
	return home_url( '/try-the-app/' );
}

/**
 * Try the App nav target: app when online, book a demo otherwise.
 */
function bianca_wellness_try_app_link_url() {
	if ( bianca_wellness_production_app_window_open() ) {
		return bianca_wellness_try_app_page_url();
	}

	return bianca_wellness_book_demo_url();
}

/**
 * Whether production app EC2 is scheduled to be running (America/Los_Angeles).
 * Mirrors packages/backend/devops/terraform/production-schedule.tf defaults.
 */
function bianca_wellness_production_app_window_open() {
	try {
		$now = new DateTime( 'now', new DateTimeZone( 'America/Los_Angeles' ) );
	} catch ( Exception $e ) {
		return true;
	}
	$minutes = (int) $now->format( 'G' ) * 60 + (int) $now->format( 'i' );
	$start   = 7 * 60;
	$stop    = 13 * 60;

	return $minutes >= $start && $minutes < $stop;
}

/**
 * Theme setup.
 */
function bianca_wellness_setup() {
	load_theme_textdomain( 'bianca-wellness', get_template_directory() . '/languages' );

	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'align-wide' );
	add_theme_support( 'editor-styles' );
	add_editor_style( 'assets/css/editor-style.css' );

	add_theme_support(
		'custom-logo',
		array(
			'height'      => 80,
			'width'       => 240,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);

	register_nav_menus(
		array(
			'primary' => __( 'Primary (header)', 'bianca-wellness' ),
			'footer'  => __( 'Footer', 'bianca-wellness' ),
		)
	);
}
add_action( 'after_setup_theme', 'bianca_wellness_setup' );

/**
 * Enqueue Google Font + main CSS.
 */
function bianca_wellness_assets() {
	wp_enqueue_style(
		'bianca-wellness-fonts',
		'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap',
		array(),
		null
	);

	wp_enqueue_style(
		'bianca-wellness-main',
		get_template_directory_uri() . '/assets/css/main.css',
		array( 'bianca-wellness-fonts' ),
		BIANCA_WELLNESS_VERSION
	);

	wp_enqueue_style(
		'bianca-wellness-style',
		get_stylesheet_uri(),
		array( 'bianca-wellness-main' ),
		BIANCA_WELLNESS_VERSION
	);
}
add_action( 'wp_enqueue_scripts', 'bianca_wellness_assets' );

/**
 * Body class for global styling.
 */
function bianca_wellness_body_class( $classes ) {
	$classes[] = 'bianca-wellness-theme';
	return $classes;
}
add_filter( 'body_class', 'bianca_wellness_body_class' );

/**
 * Fallback nav links (until a menu is assigned in Appearance → Menus).
 */
function bianca_wellness_default_nav() {
	$items = array(
		array( 'href' => '#solution', 'label' => __( 'Solutions', 'bianca-wellness' ) ),
		array( 'href' => '/about', 'label' => __( 'Company', 'bianca-wellness' ) ),
		array( 'href' => '/blog', 'label' => __( 'Resources', 'bianca-wellness' ) ),
		array( 'href' => '/contact', 'label' => __( 'Contact Us', 'bianca-wellness' ) ),
		array( 'href' => bianca_wellness_try_app_link_url(), 'label' => __( 'Try the App', 'bianca-wellness' ) ),
	);
	echo '<ul class="bianca-nav__list">';
	foreach ( $items as $item ) {
		$t = ! empty( $item['new'] ) ? ' target="_blank" rel="noopener noreferrer"' : '';
		echo '<li><a href="' . esc_url( $item['href'] ) . '"' . $t . '>' . esc_html( $item['label'] ) . '</a></li>';
	}
	echo '</ul>';
}

require_once get_template_directory() . '/inc/book-demo.php';
require_once get_template_directory() . '/inc/seed-content.php';
require_once get_template_directory() . '/inc/legal-content.php';
require_once get_template_directory() . '/inc/page-title.php';

/**
 * Point assigned "Try the App" menu items at Book a Demo when the app is offline.
 *
 * @param WP_Post[] $items Menu items.
 * @param stdClass  $args  wp_nav_menu() args.
 */
function bianca_wellness_filter_try_app_menu_links( $items, $args ) {
	if ( bianca_wellness_production_app_window_open() ) {
		return $items;
	}

	if ( empty( $args->theme_location ) || ! in_array( $args->theme_location, array( 'primary', 'footer' ), true ) ) {
		return $items;
	}

	$demo_url = bianca_wellness_book_demo_url();

	foreach ( $items as $item ) {
		$path = wp_parse_url( $item->url, PHP_URL_PATH );
		$slug = is_string( $path ) ? trim( $path, '/' ) : '';

		if ( $slug === 'try-the-app' || stripos( $item->title, 'Try the App' ) !== false ) {
			$item->url = $demo_url;
		}
	}

	return $items;
}
add_filter( 'wp_nav_menu_objects', 'bianca_wellness_filter_try_app_menu_links', 10, 2 );

/**
 * Create /try-the-app/ page if missing (redirect handles all visitor traffic).
 */
function bianca_wellness_seed_try_app_page() {
	$existing = get_posts(
		array(
			'name'           => 'try-the-app',
			'post_type'      => 'page',
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'fields'         => 'ids',
		)
	);
	if ( ! empty( $existing ) ) {
		update_option( 'bianca_wellness_try_app_seeded', 1 );
		return;
	}

	if ( get_option( 'bianca_wellness_try_app_seeded' ) ) {
		return;
	}

	$page_id = wp_insert_post(
		array(
			'post_title'  => __( 'Try the App', 'bianca-wellness' ),
			'post_name'   => 'try-the-app',
			'post_status' => 'publish',
			'post_type'   => 'page',
		),
		true
	);

	if ( ! is_wp_error( $page_id ) && $page_id ) {
		update_option( 'bianca_wellness_try_app_seeded', 1 );
	}
}
add_action( 'after_switch_theme', 'bianca_wellness_seed_try_app_page' );
add_action( 'init', 'bianca_wellness_seed_try_app_page' );

/**
 * /try-the-app/: app when online, Book a Demo form when offline.
 */
function bianca_wellness_try_app_gate() {
	if ( ! is_page( 'try-the-app' ) ) {
		return;
	}

	if ( bianca_wellness_production_app_window_open() ) {
		wp_safe_redirect( bianca_wellness_app_url() );
		exit;
	}

	wp_safe_redirect( bianca_wellness_book_demo_url() );
	exit;
}
add_action( 'template_redirect', 'bianca_wellness_try_app_gate' );
