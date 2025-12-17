import React, { useLayoutEffect, useState } from "react"
import { Image, ImageProps, ImageURISource, Platform } from "react-native"

export interface AutoImageProps extends ImageProps {
  /**
   * How wide should the image be?
   */
  maxWidth?: number
  /**
   * How tall should the image be?
   */
  maxHeight?: number
}

/**
 * A hook that will return the scaled dimensions of an image based on the
 * provided dimensions' aspect ratio. If no desired dimensions are provided,
 * it will return the original dimensions of the remote image.
 *
 * How is this different from `resizeMode: 'contain'`? Firstly, you can
 * specify only one side's size (not both). Secondly, the image will scale to fit
 * the desired dimensions instead of just being contained within its image-container.
 * @param {number} remoteUri - The URI of the remote image.
 * @param {number} dimensions - The desired dimensions of the image. If not provided, the original dimensions will be returned.
 * @returns {[number, number]} - The scaled dimensions of the image.
 */
export function useAutoImage(
  remoteUri: string,
  dimensions?: [maxWidth?: number, maxHeight?: number],
): [width: number, height: number] {
  const [[remoteWidth, remoteHeight], setRemoteImageDimensions] = useState([0, 0])
  const remoteAspectRatio = remoteWidth / remoteHeight
  const [maxWidth, maxHeight] = dimensions ?? []

  useLayoutEffect(() => {
    if (!remoteUri) return

    Image.getSize(
      remoteUri,
      (w, h) => setRemoteImageDimensions([w, h]),
      (error) => {
        // If image fails to load, use max dimensions as fallback if provided
        if (maxWidth && maxHeight) {
          setRemoteImageDimensions([maxWidth, maxHeight])
        }
      }
    )
  }, [remoteUri, maxWidth, maxHeight])

  // If dimensions are 0 (image not loaded yet or failed), use max dimensions as fallback
  if (remoteWidth === 0 || remoteHeight === 0) {
    if (maxWidth && maxHeight) return [maxWidth, maxHeight]
    if (maxWidth) return [maxWidth, maxWidth]
    if (maxHeight) return [maxHeight, maxHeight]
    return [32, 32] // Default fallback size
  }

  if (Number.isNaN(remoteAspectRatio)) {
    // If aspect ratio is invalid, use max dimensions as fallback
    if (maxWidth && maxHeight) return [maxWidth, maxHeight]
    return [32, 32] // Default fallback size
  }

  if (maxWidth && maxHeight) {
    const aspectRatio = Math.min(maxWidth / remoteWidth, maxHeight / remoteHeight)
    return [remoteWidth * aspectRatio, remoteHeight * aspectRatio]
  } else if (maxWidth) {
    return [maxWidth, maxWidth / remoteAspectRatio]
  } else if (maxHeight) {
    return [maxHeight * remoteAspectRatio, maxHeight]
  } else {
    return [remoteWidth, remoteHeight]
  }
}

/**
 * An Image component that automatically sizes a remote or data-uri image.
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/components/AutoImage/}
 * @param {AutoImageProps} props - The props for the `AutoImage` component.
 * @returns {JSX.Element} The rendered `AutoImage` component.
 */
export function AutoImage(props: AutoImageProps) {
  const { maxWidth, maxHeight, ...ImageProps } = props
  const source = props.source as ImageURISource

  const [width, height] = useAutoImage(
    Platform.select({
      web: (source?.uri as string) ?? (source as string),
      default: source?.uri as string,
    }),
    [maxWidth, maxHeight],
  )

  // Extract style dimensions as fallback
  const style = props.style as any
  const styleWidth = style?.width
  const styleHeight = style?.height

  // Use calculated dimensions, or fall back to max dimensions, or style dimensions, or default
  const finalWidth = width > 0 ? width : (maxWidth || styleWidth || 32)
  const finalHeight = height > 0 ? height : (maxHeight || styleHeight || 32)

  return <Image {...ImageProps} style={[{ width: finalWidth, height: finalHeight }, props.style]} />
}
