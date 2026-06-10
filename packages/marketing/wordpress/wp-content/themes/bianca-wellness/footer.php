<?php
/**
 * Footer — optional menu + site info (editable via widgets/menus/customizer in future).
 *
 * @package Bianca_Wellness
 */
?>
</main>

<footer class="bianca-footer">
	<div class="bianca-container bianca-footer__grid">
		<div class="bianca-footer__brand">
			<?php if ( has_custom_logo() ) : ?>
				<div class="bianca-footer__logo"><?php the_custom_logo(); ?></div>
			<?php else : ?>
				<strong class="bianca-footer__name"><?php bloginfo( 'name' ); ?></strong>
			<?php endif; ?>
			<p class="bianca-footer__tagline"><?php bloginfo( 'description' ); ?></p>
		</div>
		<?php if ( has_nav_menu( 'footer' ) ) : ?>
			<nav class="bianca-footer__nav" aria-label="<?php esc_attr_e( 'Footer', 'bianca-wellness' ); ?>">
				<?php
				wp_nav_menu(
					array(
						'theme_location' => 'footer',
						'container'      => false,
						'menu_class'     => 'bianca-footer__list',
						'depth'          => 1,
					)
				);
				?>
			</nav>
		<?php endif; ?>
		<div class="bianca-footer__meta">
			<p class="bianca-footer__email">
				<a href="mailto:sales@biancawellness.com">sales@biancawellness.com</a>
			</p>
			<p class="bianca-footer__copy">&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?>. <?php esc_html_e( 'All rights reserved.', 'bianca-wellness' ); ?></p>
		</div>
	</div>
</footer>
<?php wp_footer(); ?>
<script>
(function(){
	var btn = document.querySelector('.bianca-nav-toggle');
	var nav = document.getElementById('bianca-primary-nav');
	if (btn && nav) {
		btn.addEventListener('click', function() {
			var open = nav.classList.toggle('is-open');
			btn.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
	}
})();
</script>
</body>
</html>
