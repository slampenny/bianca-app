<?php
/**
 * Single post.
 *
 * @package Bianca_Wellness
 */

get_header();
?>
<div class="bianca-page bianca-container bianca-prose">
	<?php
	while ( have_posts() ) {
		the_post();
		the_title( '<h1 class="bianca-page__title">', '</h1>' );
		if ( has_post_thumbnail() ) {
			echo '<figure class="bianca-blog__featured">';
			the_post_thumbnail( 'large' );
			echo '</figure>';
		}
		the_content();
	}
	?>
</div>
<?php
get_footer();
