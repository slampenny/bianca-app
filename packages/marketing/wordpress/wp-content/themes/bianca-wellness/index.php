<?php
/**
 * Fallback / blog index.
 *
 * @package Bianca_Wellness
 */

get_header();
?>
<div class="bianca-page bianca-container bianca-prose">
	<?php if ( have_posts() ) : ?>
		<?php
		while ( have_posts() ) :
			the_post();
			?>
			<article <?php post_class( 'bianca-post-excerpt' ); ?>>
				<h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
				<?php the_excerpt(); ?>
			</article>
			<?php
		endwhile;
		the_posts_navigation();
		?>
	<?php else : ?>
		<p><?php esc_html_e( 'No posts found.', 'bianca-wellness' ); ?></p>
	<?php endif; ?>
</div>
<?php
get_footer();
