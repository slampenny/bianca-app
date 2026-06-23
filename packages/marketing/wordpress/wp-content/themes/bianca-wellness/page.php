<?php
/**
 * Default page template — content from block editor.
 *
 * @package Bianca_Wellness
 */

get_header();
?>
<div class="bianca-page bianca-page--standard bianca-container bianca-prose">
	<?php
	while ( have_posts() ) {
		the_post();
		if ( bianca_wellness_should_render_page_title() ) {
			the_title( '<h1 class="bianca-page__title">', '</h1>' );
		}
		the_content();
	}
	?>
</div>
<?php
get_footer();
