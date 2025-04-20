import React from "react"
import { Pressable, StyleSheet } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSelector } from "react-redux"
import { getCurrentUser } from "app/store/authSlice"
import { AutoImage } from "app/components"

// Use a remote placeholder image URL (e.g., Gravatar's default "mystery person")
const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp"

const ProfileButton: React.FC = () => {
  const navigation = useNavigation()
  const currentUser = useSelector(getCurrentUser)
  return (
    <Pressable style={styles.profileButton} onPress={() => navigation.navigate("Profile")}>
      <AutoImage
        source={currentUser?.avatar ? { uri: currentUser.avatar } : { uri: defaultAvatarUrl }}
        style={styles.avatar}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 16,
    height: 32,
    resizeMode: "cover",
    width: 32,
  },
  profileButton: {
    marginRight: 15,
  },
})

export default ProfileButton
