<?php
/**
 * Legal pages — seeded from data/legal/*.md (synced from @bianca/legal).
 *
 * @package Bianca_Wellness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WordPress page definitions synced from packages/legal/pages.json.
 *
 * @return array<int, array{slug: string, title: string, file: string}>
 */
function bianca_wellness_legal_page_definitions() {
	$config_file = get_template_directory() . '/data/legal/pages.json';
	if ( is_readable( $config_file ) ) {
		$decoded = json_decode( (string) file_get_contents( $config_file ), true );
		if ( is_array( $decoded ) && ! empty( $decoded ) ) {
			return $decoded;
		}
	}

	return array(
		array( 'slug' => 'terms', 'title' => 'Terms of Service', 'file' => 'TERMS.md' ),
		array( 'slug' => 'privacy', 'title' => 'Privacy Policy', 'file' => 'PRIVACY.md' ),
		array( 'slug' => 'privacy-pipeda', 'title' => 'Privacy Policy (Canada)', 'file' => 'PRIVACY_PIPEDA.md' ),
		array( 'slug' => 'privacy-practices', 'title' => 'Notice of Privacy Practices', 'file' => 'NOTICE_OF_PRIVACY_PRACTICES.md' ),
		array( 'slug' => 'cross-border-data-transfers', 'title' => 'Cross-Border Data Transfers', 'file' => 'CROSS_BORDER_DATA_TRANSFERS.md' ),
		array( 'slug' => 'data-safety', 'title' => 'Data Safety', 'file' => 'DATA_SAFETY.md' ),
	);
}

/**
 * Minimal markdown → HTML for legal prose (headings, lists, paragraphs, emphasis, hr, links).
 *
 * @param string $markdown Source markdown.
 */
function bianca_wellness_markdown_to_html( $markdown ) {
	$markdown = str_replace( array( "\r\n", "\r" ), "\n", (string) $markdown );
	$lines    = explode( "\n", $markdown );
	$html     = '';
	$in_ul    = false;
	$in_ol    = false;

	$close_lists = static function () use ( &$html, &$in_ul, &$in_ol ) {
		if ( $in_ul ) {
			$html .= '</ul>';
			$in_ul = false;
		}
		if ( $in_ol ) {
			$html .= '</ol>';
			$in_ol = false;
		}
	};

	$inline = static function ( $text ) {
		$text = esc_html( $text );
		$text = preg_replace( '/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $text );
		$text = preg_replace( '/\*(.+?)\*/s', '<em>$1</em>', $text );
		$text = preg_replace( '/\[([^\]]+)\]\(([^)]+)\)/', '<a href="$2">$1</a>', $text );
		return $text;
	};

	foreach ( $lines as $line ) {
		$trim = trim( $line );

		if ( $trim === '' ) {
			$close_lists();
			continue;
		}

		if ( preg_match( '/^-{3,}$/', $trim ) ) {
			$close_lists();
			$html .= '<hr />';
			continue;
		}

		if ( preg_match( '/^(#{1,6})\s+(.+)$/', $trim, $m ) ) {
			$close_lists();
			$level = strlen( $m[1] );
			$html .= '<h' . $level . '>' . $inline( trim( $m[2] ) ) . '</h' . $level . '>';
			continue;
		}

		if ( preg_match( '/^[-*]\s+(.+)$/', $trim, $m ) ) {
			if ( $in_ol ) {
				$html .= '</ol>';
				$in_ol = false;
			}
			if ( ! $in_ul ) {
				$html .= '<ul>';
				$in_ul = true;
			}
			$html .= '<li>' . $inline( $m[1] ) . '</li>';
			continue;
		}

		if ( preg_match( '/^\d+\.\s+(.+)$/', $trim, $m ) ) {
			if ( $in_ul ) {
				$html .= '</ul>';
				$in_ul = false;
			}
			if ( ! $in_ol ) {
				$html .= '<ol>';
				$in_ol = true;
			}
			$html .= '<li>' . $inline( $m[1] ) . '</li>';
			continue;
		}

		$close_lists();
		$html .= '<p>' . $inline( $trim ) . '</p>';
	}

	$close_lists();

	return $html;
}

/**
 * Block markup for a legal page body.
 *
 * @param string $markdown Markdown source.
 */
function bianca_wellness_legal_page_block_markup( $markdown ) {
	$html = bianca_wellness_markdown_to_html( $markdown );

	return '<!-- wp:html -->
<div class="bianca-legal-prose bianca-prose">' . $html . '</div>
<!-- /wp:html -->';
}

/**
 * Create or update legal pages when theme legal files change.
 */
function bianca_wellness_sync_legal_pages_from_theme_files() {
	$legal_dir = get_template_directory() . '/data/legal';
	if ( ! is_dir( $legal_dir ) ) {
		return;
	}

	foreach ( bianca_wellness_legal_page_definitions() as $def ) {
		$file = $legal_dir . '/' . $def['file'];
		if ( ! is_readable( $file ) ) {
			continue;
		}

		$hash   = md5_file( $file );
		$option = 'bianca_legal_hash_' . $def['slug'];
		if ( ! is_string( $hash ) || $hash === '' ) {
			continue;
		}

		$markdown = (string) file_get_contents( $file );
		if ( $markdown === '' ) {
			continue;
		}

		$markup = bianca_wellness_legal_page_block_markup( $markdown );
		$posts  = get_posts(
			array(
				'name'           => $def['slug'],
				'post_type'      => 'page',
				'post_status'    => 'any',
				'posts_per_page' => 1,
			)
		);

		if ( empty( $posts ) ) {
			$page_id = wp_insert_post(
				array(
					'post_title'   => $def['title'],
					'post_name'    => $def['slug'],
					'post_status'  => 'publish',
					'post_type'    => 'page',
					'post_content' => $markup,
				),
				true
			);
			if ( ! is_wp_error( $page_id ) && $page_id ) {
				update_option( $option, $hash );
			}
			continue;
		}

		if ( get_option( $option ) === $hash ) {
			continue;
		}

		wp_update_post(
			array(
				'ID'           => (int) $posts[0]->ID,
				'post_title'   => $def['title'],
				'post_content' => $markup,
				'post_status'  => 'publish',
			)
		);
		update_option( $option, $hash );
	}
}
add_action( 'init', 'bianca_wellness_sync_legal_pages_from_theme_files', 30 );

/**
 * Whether the current (or given) page is a theme-managed legal document.
 *
 * @param WP_Post|int|null $post Post object or ID.
 */
function bianca_wellness_is_legal_page( $post = null ) {
	$post = get_post( $post );
	if ( ! $post || $post->post_type !== 'page' ) {
		return false;
	}

	$slugs = wp_list_pluck( bianca_wellness_legal_page_definitions(), 'slug' );

	return in_array( $post->post_name, $slugs, true );
}

/**
 * Header Resources: primary legal links only.
 *
 * @return array<int, array{slug: string, title: string}>
 */
function bianca_wellness_header_legal_page_definitions() {
	$wanted = array( 'privacy', 'terms', 'privacy-practices' );

	return array_values(
		array_filter(
			bianca_wellness_legal_page_definitions(),
			function ( $def ) use ( $wanted ) {
				return in_array( $def['slug'], $wanted, true );
			}
		)
	);
}

/**
 * All published legal pages for the footer.
 *
 * @return array<int, array{label: string, url: string}>
 */
function bianca_wellness_footer_legal_links() {
	$links = array();

	foreach ( bianca_wellness_legal_page_definitions() as $def ) {
		$links[] = array(
			'label' => $def['title'],
			'url'   => home_url( '/' . $def['slug'] . '/' ),
		);
	}

	return $links;
}

/**
 * Footer legal nav (all compliance docs).
 */
function bianca_wellness_render_footer_legal_nav() {
	$links = bianca_wellness_footer_legal_links();
	if ( empty( $links ) ) {
		return;
	}

	echo '<nav class="bianca-footer__legal" aria-label="' . esc_attr__( 'Legal', 'bianca-wellness' ) . '">';
	echo '<p class="bianca-footer__legal-heading">' . esc_html__( 'Legal', 'bianca-wellness' ) . '</p>';
	echo '<ul class="bianca-footer__list bianca-footer__list--legal">';
	foreach ( $links as $link ) {
		echo '<li><a href="' . esc_url( $link['url'] ) . '">' . esc_html( $link['label'] ) . '</a></li>';
	}
	echo '</ul></nav>';
}
