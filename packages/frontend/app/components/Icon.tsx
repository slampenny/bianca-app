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
    color !== undefined && { tintColor: color },
    size !== undefined && { width: size, height: size },
    $imageStyleOverride,
  ]

  return (
    <Wrapper
      accessibilityRole={isPressable ? "imagebutton" : undefined}
      {...WrapperProps}
      style={$containerStyleOverride}
    >
      <Image style={$imageStyle} source={iconRegistry[icon]} />
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
}

const $imageStyleBase: ImageStyle = {
  resizeMode: "contain",
}
