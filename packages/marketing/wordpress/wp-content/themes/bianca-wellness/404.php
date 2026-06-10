<?php
/**
 * 404
 *
 * @package Bianca_Wellness
 */

get_header();
?>
<div class="bianca-page bianca-container bianca-prose" style="min-height:40vh;padding-top:4rem;">
	<h1><?php esc_html_e( 'Page not found', 'bianca-wellness' ); ?></h1>
	<p><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Back to home', 'bianca-wellness' ); ?></a></p>
</div>
<?php
get_footer();
