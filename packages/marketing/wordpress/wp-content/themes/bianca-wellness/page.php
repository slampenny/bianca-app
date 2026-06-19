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
		the_title( '<h1 class="bianca-page__title">', '</h1>' );
		the_content();
	}
	?>
</div>
<?php
get_footer();
