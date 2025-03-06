import React, { useState, useEffect } from "react"
import {
  Platform,
  Image,
  View,
  StyleSheet,
  Pressable,
  Text,
} from "react-native"
import * as ImagePicker from "expo-image-picker"

interface AvatarPickerProps {
  initialAvatar: string | null
  onAvatarChanged: (uri: string) => void
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({
  initialAvatar,
  onAvatarChanged,
}) => {
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    setImage(initialAvatar)
  }, [initialAvatar])

  const pickImage = async () => {
    let result
    if (Platform.OS === "web") {
      // For web, open the image library
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      })
    } else {
      // For native, open the camera
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      })
    }

    if (!result.canceled) {
      const uri = result.assets[0].uri
      setImage(uri)
      onAvatarChanged(uri)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        {image ? (
          <Image source={{ uri: image }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.placeholderIcon}>?</Text>
          </View>
        )}
      </View>

      <Pressable style={styles.selectButton} onPress={pickImage}>
        <Text style={styles.selectButtonText}>Select Image</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    marginBottom: 10,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    fontSize: 48,
    color: "#bdc3c7",
  },
  selectButton: {
    backgroundColor: "#3498db",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 5,
  },
  selectButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
})

export default AvatarPicker
