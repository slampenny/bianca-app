<?php
/**
 * Header — structure only; nav labels come from Menus.
 *
 * @package Bianca_Wellness
 */
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'bianca-site' ); ?>>
<?php wp_body_open(); ?>

<header class="bianca-header">
	<div class="bianca-header__inner bianca-container">
		<div class="bianca-header__brand<?php echo has_custom_logo() ? ' bianca-header__brand--with-logo' : ''; ?>">
			<?php if ( has_custom_logo() ) : ?>
				<span class="bianca-header__logo-wrap"><?php the_custom_logo(); ?></span>
			<?php endif; ?>
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="bianca-logo-text" rel="home"><?php bloginfo( 'name' ); ?></a>
		</div>
		<button type="button" class="bianca-nav-toggle" aria-expanded="false" aria-controls="bianca-primary-nav" aria-label="<?php esc_attr_e( 'Menu', 'bianca-wellness' ); ?>">
			<span></span><span></span><span></span>
		</button>
		<nav class="bianca-nav" id="bianca-primary-nav" aria-label="<?php esc_attr_e( 'Primary', 'bianca-wellness' ); ?>">
			<?php
			wp_nav_menu(
				array(
					'theme_location' => 'primary',
					'container'      => false,
					'menu_class'     => 'bianca-nav__list',
					'fallback_cb'    => 'bianca_wellness_default_nav',
					'depth'          => 2,
				)
			);
			?>
		</nav>
	</div>
</header>

<main id="main" class="bianca-main">
