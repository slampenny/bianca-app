import React from "react"
import { Pressable, StyleSheet } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { DrawerParamList } from "app/navigators/navigationTypes"
import type { StackNavigationProp } from "@react-navigation/stack"
import { useSelector } from "react-redux"
import { getCurrentUser } from "app/store/authSlice"
import { AutoImage } from "app/components"

// Use a remote placeholder image URL (e.g., Gravatar's default "mystery person")
const defaultAvatarUrl = "https://www.gravatar.com/avatar/?d=mp"

const ProfileButton: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<DrawerParamList>>()
  const currentUser = useSelector(getCurrentUser)
  return (
    <Pressable
      style={styles.profileButton}
      onPress={() => navigation.navigate("Profile")}
      testID="profile-button"
      accessibilityLabel="profile-button"
      data-testid="profile-button"
      accessibilityRole="button"
    >
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
