import React from "react"
import { Pressable, StyleSheet, View, Image } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { DrawerParamList } from "app/navigators/navigationTypes"
import type { StackNavigationProp } from "@react-navigation/stack"
import { useSelector } from "react-redux"
import { getCurrentUser } from "app/store/authSlice"
import { testingProps } from "../utils/testingProps"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeContext"

const ProfileButton: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<DrawerParamList>>()
  const currentUser = useSelector(getCurrentUser)
  const { colors } = useTheme()
  const [imageError, setImageError] = React.useState(false)
  
  const hasAvatar = currentUser?.avatar && currentUser.avatar.trim() !== '' && !imageError
  
  return (
    <Pressable
      style={styles.profileButton}
      onPress={() => navigation.navigate("Profile")}
      testID="profile-button"
      {...testingProps("profile-button")}
      accessibilityLabel="Profile"
      accessibilityRole="button"
    >
      {hasAvatar ? (
        <View style={styles.avatar}>
          <Image
            source={{ uri: currentUser.avatar }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        </View>
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons 
            name="person" 
            size={20} 
            color={colors.palette.neutral600 || colors.text} 
          />
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 16,
    height: 32,
    width: 32,
    overflow: "hidden",
  },
  avatarPlaceholder: {
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  profileButton: {
    marginRight: 15,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
})

export default ProfileButton
