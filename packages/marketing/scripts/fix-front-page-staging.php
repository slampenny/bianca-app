<?php
require_once '/var/www/html/wp-load.php';

$front_page_id = get_option( 'page_on_front' );
if ( ! $front_page_id ) {
	echo "❌ No static front page set\n";
	exit;
}

$page = get_post( $front_page_id );
if ( ! $page ) {
	echo "❌ Front page not found\n";
	exit;
}

$content = $page->post_content;
$content = str_replace( 'staging.myphonefriend.com', home_url( '/try-the-app/' ), $content );
$content = str_replace( 'app.myphonefriend.com', 'https://app.biancawellness.com', $content );
$content = str_replace( 'https://app.biancawellness.com', home_url( '/try-the-app/' ), $content );

wp_update_post(
	array(
		'ID'           => $front_page_id,
		'post_content' => $content,
	)
);

echo "✅ Front page updated — Try the App links now point to /try-the-app/\n";
