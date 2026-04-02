import * as React from "react"
import { ComponentType } from "react"
import {
  Image,
  ImageStyle,
  StyleProp,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewProps,
  ViewStyle,
} from "react-native"

export type IconTypes = keyof typeof iconRegistry

interface IconProps extends TouchableOpacityProps {
  /**
   * The name of the icon
   */
  icon: IconTypes

  /**
   * An optional tint color for the icon
   */
  color?: string

  /**
   * An optional size for the icon. If not provided, the icon will be sized to the icon's resolution.
   */
  size?: number

  /**
   * Style overrides for the icon image
   */
  style?: StyleProp<ImageStyle>

  /**
   * Style overrides for the icon container
   */
  containerStyle?: StyleProp<ViewStyle>

  /**
   * An optional function to be called when the icon is pressed
   */
  onPress?: TouchableOpacityProps["onPress"]
}

/**
 * A component to render a registered icon.
 * It is wrapped in a <TouchableOpacity /> if `onPress` is provided, otherwise a <View />.
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/components/Icon/}
 * @param {IconProps} props - The props for the `Icon` component.
 * @returns {JSX.Element} The rendered `Icon` component.
 */
export function Icon(props: IconProps) {
  const {
    icon,
    color,
    size,
    style: $imageStyleOverride,
    containerStyle: $containerStyleOverride,
    ...WrapperProps
  } = props

  const isPressable = !!WrapperProps.onPress
  const Wrapper = (WrapperProps?.onPress ? TouchableOpacity : View) as ComponentType<
    TouchableOpacityProps | ViewProps
  >

  const $imageStyle: StyleProp<ImageStyle> = [
    $imageStyleBase,
    // tintColor and resizeMode should be props, not style
    size !== undefined && { width: size, height: size },
    $imageStyleOverride,
  ]

  return (
    <Wrapper
      accessibilityRole={isPressable ? "imagebutton" : undefined}
      {...WrapperProps}
      style={$containerStyleOverride}
    >
      <Image 
        style={$imageStyle} 
        source={iconRegistry[icon]}
        resizeMode="contain"
        {...(color !== undefined && { tintColor: color })}
      />
    </Wrapper>
  )
}

import Config from "../config"

const assetsBaseUrl = Config.assetsBaseUrl

export const iconRegistry = {
  back: { uri: `${assetsBaseUrl}/icons/back.png` },
  bell: { uri: `${assetsBaseUrl}/icons/bell.png` },
  caretLeft: { uri: `${assetsBaseUrl}/icons/caretLeft.png` },
  caretRight: { uri: `${assetsBaseUrl}/icons/caretRight.png` },
  check: { uri: `${assetsBaseUrl}/icons/check.png` },
  hidden: { uri: `${assetsBaseUrl}/icons/hidden.png` },
  lock: { uri: `${assetsBaseUrl}/icons/lock.png` },
  menu: { uri: `${assetsBaseUrl}/icons/menu.png` },
  more: { uri: `${assetsBaseUrl}/icons/more.png` },
  settings: { uri: `${assetsBaseUrl}/icons/settings.png` },
  view: { uri: `${assetsBaseUrl}/icons/view.png` },
  x: { uri: `${assetsBaseUrl}/icons/x.png` },
  // Extended set for sentiment and other screens (fallback to existing assets)
  question: { uri: `${assetsBaseUrl}/icons/more.png` },
  checkCircle: { uri: `${assetsBaseUrl}/icons/check.png` },
  xCircle: { uri: `${assetsBaseUrl}/icons/x.png` },
  minusCircle: { uri: `${assetsBaseUrl}/icons/more.png` },
  alertCircle: { uri: `${assetsBaseUrl}/icons/bell.png` },
  alertTriangle: { uri: `${assetsBaseUrl}/icons/bell.png` },
  phoneOff: { uri: `${assetsBaseUrl}/icons/x.png` },
  calendar: { uri: `${assetsBaseUrl}/icons/view.png` },
  clock: { uri: `${assetsBaseUrl}/icons/lock.png` },
  shield: { uri: `${assetsBaseUrl}/icons/lock.png` },
  target: { uri: `${assetsBaseUrl}/icons/view.png` },
  heart: { uri: `${assetsBaseUrl}/icons/check.png` },
  smile: { uri: `${assetsBaseUrl}/icons/check.png` },
  frown: { uri: `${assetsBaseUrl}/icons/x.png` },
  meh: { uri: `${assetsBaseUrl}/icons/more.png` },
  zap: { uri: `${assetsBaseUrl}/icons/view.png` },
  lightbulb: { uri: `${assetsBaseUrl}/icons/view.png` },
  arrowUp: { uri: `${assetsBaseUrl}/icons/caretRight.png` },
  arrowDown: { uri: `${assetsBaseUrl}/icons/caretRight.png` },
  minus: { uri: `${assetsBaseUrl}/icons/more.png` },
  caretDown: { uri: `${assetsBaseUrl}/icons/caretRight.png` },
}

const $imageStyleBase: ImageStyle = {
  // resizeMode moved to Image props to fix deprecation warning
}
