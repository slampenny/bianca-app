<?php
/**
 * Front page — all marketing copy comes from the assigned static front page (block editor).
 *
 * @package Bianca_Wellness
 */

get_header();
?>
<div class="bianca-page bianca-page--front">
	<?php
	while ( have_posts() ) {
		the_post();
		the_content();
	}
	?>
</div>
<?php
get_footer();
