import React, { useState, useEffect } from "react"
import { Platform, Image, View, StyleSheet, Pressable } from "react-native"
import { Text } from "app/components/Text"
import * as ImagePicker from "expo-image-picker"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { useLanguage } from "../hooks/useLanguage"
import { logger } from "../utils/logger"

interface AvatarPickerProps {
  initialAvatar: string | null
  onAvatarChanged: (avatarData: { uri: string; blob?: Blob }) => void
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({ initialAvatar, onAvatarChanged }) => {
  const { colors } = useTheme()
  const [image, setImage] = useState<string | null>(null)
  const { currentLanguage } = useLanguage() // This will trigger re-render when language changes
  
  logger.debug("AvatarPicker rendered with language:", currentLanguage)

  useEffect(() => {
    if (initialAvatar) {
      // Check if the URL is relative (starts with /)
      let fullUrl = initialAvatar
      if (initialAvatar.startsWith("/")) {
        // For development, add the base URL
        // In production, relative URLs should work fine
        fullUrl = `${window.location.origin}${initialAvatar}`
      }

      logger.debug("Setting initial avatar URL:", fullUrl)
      setImage(fullUrl)
    } else {
      setImage(null)
    }
  }, [initialAvatar])

  const processImage = async (uri: string) => {
    try {
      // For blob URLs or remote URLs, we need to fetch the file
      if (uri.startsWith("blob:") || uri.startsWith("http") || uri.startsWith("file:")) {
        const response = await fetch(uri)
        const blob = await response.blob()
        setImage(uri)
        onAvatarChanged({ uri, blob })
        return
      }

      // For data URLs, convert to a Blob
      if (uri.startsWith("data:")) {
        const matches = uri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)

        if (matches && matches.length === 3) {
          const contentType = matches[1]
          const base64Data = matches[2]
          const byteCharacters = atob(base64Data)
          const byteArrays = []

          for (let i = 0; i < byteCharacters.length; i += 512) {
            const slice = byteCharacters.slice(i, i + 512)
            const byteNumbers = new Array(slice.length)
            for (let j = 0; j < slice.length; j++) {
              byteNumbers[j] = slice.charCodeAt(j)
            }
            byteArrays.push(new Uint8Array(byteNumbers))
          }

          const blob = new Blob(byteArrays, { type: contentType })
          setImage(uri)
          onAvatarChanged({ uri, blob })
          return
        }
      }

      // If we can't process it as a blob, just pass the URI
      setImage(uri)
      onAvatarChanged({ uri })
    } catch (error) {
      console.error("Error processing image:", error)
      // Still set the image and pass the URI if processing fails
      setImage(uri)
      onAvatarChanged({ uri })
    }
  }

  const pickImage = async () => {
    try {
      // Use launchImageLibraryAsync for all platforms
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      })

      if (!result.canceled) {
        const uri = result.assets[0].uri
        logger.debug("Selected image URI:", uri)
        // Process the image and notify parent component
        await processImage(uri)
      }
    } catch (error) {
      console.error("Error picking image:", error)
    }
  }

  const styles = createStyles(colors)
  
  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.avatarImage}
            onError={(e) => console.error("Error loading image:", e.nativeEvent.error)}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.placeholderIcon}>?</Text>
          </View>
        )}
      </View>
      <Pressable style={styles.selectButton} onPress={pickImage}>
        <Text style={styles.selectButtonText}>{translate("common.selectImage")}</Text>
      </Pressable>

      {/* Debug text to show the current image URI
      {__DEV__ && image && (
        <Text style={styles.debugText}>
          Image: {image.substring(0, 30)}...
        </Text>
      )} */}
    </View>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  avatarContainer: {
    alignItems: "center",
    backgroundColor: colors.palette.neutral200,
    borderRadius: 60,
    height: 120,
    justifyContent: "center",
    marginBottom: 10,
    overflow: "hidden",
    width: 120,
  },
  avatarImage: {
    height: "100%",
    resizeMode: "cover",
    width: "100%",
  },
  avatarPlaceholder: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    marginBottom: 20,
  },
  placeholderIcon: {
    color: colors.palette.neutral400,
    fontSize: 48,
  },
  selectButton: {
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectButtonText: {
    // Use neutral900 which is white in dark mode, white in light mode for contrast on colored buttons
    color: colors.palette.neutral900 || colors.palette.neutral100,
    fontSize: 16,
    fontWeight: "600",
  },
})

export default AvatarPicker
